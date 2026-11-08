import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  MapPin,
  RefreshCw,
  Thermometer,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getLiveIntelligence, syncLiveIntelligence } from "@/lib/live-intel.functions";
import {
  HAZARDS,
  LANGUAGES,
  buildCapXmlDocument,
  hazardAccentClass,
  hazardLabel,
  severityLabel,
  statusClass,
  statusLabel,
  type AlertStatus,
  type Hazard,
  type Severity,
} from "@/lib/safealert";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Live Public Alerts & WHO/NCDC Surveillance — SafeAlert" },
      {
        name: "description",
        content:
          "Autonomous live pandemic, flood, heatwave, and security warnings from WHO, NCDC, Open-Meteo, and the National SafeAlert Authority.",
      },
      { property: "og:title", content: "Live Public Alerts — SafeAlert" },
      {
        property: "og:description",
        content:
          "Real-time national broadcasts and autonomous WHO/NCDC pandemic & multi-hazard surveillance.",
      },
    ],
  }),
  component: PublicAlerts,
});

type PublicAlert = {
  id: string;
  hazard: Hazard;
  severity: Severity;
  status: AlertStatus;
  headline: string;
  message: string;
  instructions: string | null;
  languages: string[];
  siren_enabled: boolean;
  evacuation_map_url: string | null;
  issued_at: string | null;
  expires_at: string | null;
  alert_zones: { zones: { code: string; name: string } | null }[];
};

function timeAgo(iso: string | null) {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function getDeviceHash(): string {
  if (typeof window === "undefined") return "server";
  const key = "safealert_device_hash";
  let existing = localStorage.getItem(key);
  if (!existing) {
    existing = `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem(key, existing);
  }
  return existing;
}

function getAckedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("safealert_acked_alerts");
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveAckedSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem("safealert_acked_alerts", JSON.stringify([...set]));
}

/** Synthesizes the standard dual-tone (853 Hz + 960 Hz) emergency attention signal via Web Audio API. */
function playEmergencySiren() {
  if (typeof window === "undefined") return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc2.type = "sawtooth";
  osc1.frequency.setValueAtTime(853, ctx.currentTime);
  osc2.frequency.setValueAtTime(960, ctx.currentTime);

  osc1.connect(gain);
  osc2.connect(gain);
  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 1.8);
  osc2.stop(ctx.currentTime + 1.8);
}

function PublicAlerts() {
  const queryClient = useQueryClient();
  const fetchLiveIntel = useServerFn(getLiveIntelligence);
  const runSyncLiveIntel = useServerFn(syncLiveIntelligence);
  const [syncingSources, setSyncingSources] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [ackedIds, setAckedIds] = useState<Set<string>>(() => new Set());
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [hazardFilter, setHazardFilter] = useState<Hazard | "all">("all");
  const [showAutonomousFeed, setShowAutonomousFeed] = useState<boolean>(true);
  const [openCapId, setOpenCapId] = useState<string | null>(null);

  useEffect(() => {
    setAckedIds(getAckedSet());
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("public-alerts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["public-alerts"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-alerts", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("alerts")
        .select(
          "id, hazard, severity, status, headline, message, instructions, languages, siren_enabled, evacuation_map_url, issued_at, expires_at, alert_zones(zones(code, name))",
        )
        .order("issued_at", { ascending: false })
        .limit(50);

      if (statusFilter === "active") {
        query = query.in("status", ["broadcasting", "live"]);
      } else {
        query = query.in("status", ["broadcasting", "live", "expired"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as PublicAlert[];
    },
    refetchInterval: 30_000,
  });

  const liveIntelQuery = useQuery({
    queryKey: ["live-autonomous-intel"],
    queryFn: () => fetchLiveIntel(),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const filteredAlerts = (data ?? []).filter((a) =>
    hazardFilter === "all" ? true : a.hazard === hazardFilter,
  );

  const filteredIntelItems = (liveIntelQuery.data?.items ?? []).filter((item) =>
    hazardFilter === "all" ? true : item.hazard === hazardFilter,
  );

  async function acknowledgeAlert(alert: PublicAlert) {
    if (ackedIds.has(alert.id)) return;
    setAckingId(alert.id);
    const firstZone = alert.alert_zones[0]?.zones?.code ?? null;
    const { error } = await supabase.from("alert_acknowledgements").insert({
      alert_id: alert.id,
      zone_code: firstZone,
      device_hash: getDeviceHash(),
    });
    setAckingId(null);
    if (error) {
      toast.error("Could not record receipt acknowledgement.");
      return;
    }
    const next = new Set(ackedIds);
    next.add(alert.id);
    setAckedIds(next);
    saveAckedSet(next);
    toast.success("Receipt acknowledged. Stay safe and follow official instructions.");
  }

  async function handleSyncLiveSources() {
    setSyncingSources(true);
    try {
      const res = await runSyncLiveIntel();
      queryClient.setQueryData(["live-autonomous-intel"], res.feed);
      await queryClient.invalidateQueries({ queryKey: ["public-alerts"] });
      setLastSyncedAt(res.syncedAt);
      toast.success(
        `Synced ${res.onlineSourcesCount}/4 live sources (WHO, NCDC, RSS, Open-Meteo) · ${res.feed.items.length} active signals (${res.syncedAlertsCount} DB alerts verified)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync live sources");
    } finally {
      setSyncingSources(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="pulse-live inline-block h-2 w-2 rounded-full bg-signal" />
              <p className="text-eyebrow">Autonomous Live Feed · WHO · NCDC · CAP 1.2</p>
            </div>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Live Emergency &amp; Outbreak Alerts
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Automatically synchronized with official World Health Organization (WHO) Disease
              Outbreak News, Nigeria Centre for Disease Control (NCDC) SitReps, Open-Meteo
              telemetry, and National Command broadcasts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncLiveSources}
              disabled={syncingSources || liveIntelQuery.isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${
                  syncingSources || liveIntelQuery.isFetching ? "animate-spin" : ""
                }`}
              />
              {syncingSources ? "Syncing WHO & NCDC…" : "Sync Live Sources"}
            </Button>
            <Button variant="outline" size="sm" onClick={playEmergencySiren}>
              <Volume2 className="mr-1.5 h-3.5 w-3.5 text-primary" /> Test Siren
            </Button>
          </div>
        </div>

        {/* Live Source Connection Status Bar */}
        {liveIntelQuery.data && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-[11px]">
            <div className="flex flex-wrap items-center gap-3">
              {[
                { label: "WHO Outbreak API", ok: liveIntelQuery.data.sourcesOnline.whoApi },
                { label: "NCDC SitRep Scraper", ok: liveIntelQuery.data.sourcesOnline.ncdcScraper },
                { label: "Nigeria Health RSS", ok: liveIntelQuery.data.sourcesOnline.nigeriaRss },
                { label: "Open-Meteo Weather", ok: liveIntelQuery.data.sourcesOnline.openMeteo },
              ].map((src) => (
                <span key={src.label} className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      src.ok ? "bg-success" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-foreground">{src.label}</span>
                </span>
              ))}
            </div>
            <span className="text-muted-foreground">
              Last Synced:{" "}
              <strong className="text-foreground">
                {new Date(
                  lastSyncedAt ?? liveIntelQuery.data.fetchedAt,
                ).toLocaleTimeString()}
              </strong>
            </span>
          </div>
        )}

        {/* Live Atmospheric & Meteorological Zone Telemetry (Open-Meteo API) */}
        {(liveIntelQuery.data?.zoneWeather ?? []).length > 0 && (
          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(liveIntelQuery.data?.zoneWeather ?? []).map((zw) => (
              <div
                key={zw.zoneCode}
                className="command-card rounded-xl border border-border p-3.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] font-semibold uppercase text-primary">
                    {zw.zoneCode}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-foreground">
                    <Thermometer className="h-3 w-3 text-primary" />
                    {zw.temperatureC.toFixed(1)}°C
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-foreground">{zw.zoneName}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                  {zw.conditionLabel} · Wind {zw.windSpeedKmh} km/h
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Filters bar */}
        <div className="mt-6 flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface/60 p-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHazardFilter("all")}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wider transition-colors ${
                hazardFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              All Hazards
            </button>
            {HAZARDS.map((h) => (
              <button
                key={h.value}
                type="button"
                onClick={() => setHazardFilter(h.value)}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wider transition-colors ${
                  hazardFilter === h.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAutonomousFeed((v) => !v)}
              className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-medium uppercase transition-colors ${
                showAutonomousFeed
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {showAutonomousFeed ? "✓ Live WHO/NCDC Feed On" : "Live WHO/NCDC Feed Off"}
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded px-2.5 py-1 font-mono text-[11px] uppercase ${
                  statusFilter === "active"
                    ? "bg-secondary font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded px-2.5 py-1 font-mono text-[11px] uppercase ${
                  statusFilter === "all"
                    ? "bg-secondary font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 1: National Broadcast Stream */}
        <section className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              Active National Broadcasts ({filteredAlerts.length})
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              CAP 1.2 · Cellular, Satellite &amp; SMS
            </span>
          </div>

          {isLoading && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading current broadcasts…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              Could not load the broadcast feed. Please refresh.
            </div>
          )}

          {filteredAlerts.map((alert) => {
            const isAcked = ackedIds.has(alert.id);
            const showCap = openCapId === alert.id;
            const langLabels = (alert.languages ?? ["en"])
              .map((code) => LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase())
              .join(", ");

            const capXml = buildCapXmlDocument({
              id: alert.id,
              hazard: alert.hazard,
              severity: alert.severity,
              headline: alert.headline,
              message: alert.message,
              instructions: alert.instructions,
              languages: alert.languages,
              sent: alert.issued_at,
              expires: alert.expires_at,
              zones: alert.alert_zones
                .map((z) => z.zones)
                .filter((z): z is { code: string; name: string } => Boolean(z)),
            });

            return (
              <article
                key={alert.id}
                className="command-card rounded-xl border border-border p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase ${hazardAccentClass(alert.hazard)}`}
                  >
                    {hazardLabel(alert.hazard)}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase ${statusClass(alert.status)}`}
                  >
                    {statusLabel(alert.status)}
                  </span>
                  <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">
                    Severity: {severityLabel(alert.severity)}
                  </span>
                  {alert.siren_enabled && (
                    <button
                      type="button"
                      onClick={playEmergencySiren}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase text-primary hover:bg-primary/15 sm:ml-auto"
                    >
                      <Volume2 className="h-3 w-3" /> Sound Siren
                    </button>
                  )}
                </div>

                <h3 className="mt-3 font-display text-lg font-bold sm:text-xl">{alert.headline}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {alert.message}
                </p>

                {alert.instructions && (
                  <div className="mt-4 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-warning">
                        Protective Action Instruction
                      </p>
                      <p className="mt-1 text-sm text-foreground">{alert.instructions}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Issued {timeAgo(alert.issued_at)}
                  </span>
                  {alert.alert_zones.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {alert.alert_zones
                        .map((z) => z.zones?.name)
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> {langLabels}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={isAcked ? "secondary" : "default"}
                      disabled={isAcked || ackingId === alert.id}
                      onClick={() => acknowledgeAlert(alert)}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      {isAcked
                        ? "Receipt Acknowledged"
                        : ackingId === alert.id
                          ? "Recording…"
                          : "Acknowledge Receipt"}
                    </Button>

                    {alert.evacuation_map_url && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={alert.evacuation_map_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Evacuation Map
                        </a>
                      </Button>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-mono text-xs"
                    onClick={() => setOpenCapId(showCap ? null : alert.id)}
                  >
                    <Code2 className="mr-1.5 h-3.5 w-3.5" />
                    {showCap ? "Hide CAP 1.2 XML" : "Inspect CAP 1.2 XML"}
                  </Button>
                </div>

                {showCap && (
                  <div className="mt-4 rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                        OASIS CAP 1.2 Signed Broadcast Envelope
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 font-mono text-[11px]"
                        onClick={() => {
                          navigator.clipboard.writeText(capXml);
                          toast.success("CAP 1.2 XML copied to clipboard.");
                        }}
                      >
                        <Copy className="mr-1.5 h-3 w-3" /> Copy XML
                      </Button>
                    </div>
                    <pre className="mt-3 max-h-60 overflow-auto font-mono text-xs leading-relaxed text-muted-foreground">
                      <code>{capXml}</code>
                    </pre>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {/* SECTION 2: Autonomous Live WHO & NCDC Pandemic & Multi-Hazard Surveillance */}
        {showAutonomousFeed && (
          <section className="mt-12 space-y-4 border-t border-border pt-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-xl font-bold">
                    Autonomous Government &amp; WHO Pandemic Surveillance
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Independent, automated real-time scraping &amp; API ingestion from WHO Disease
                  Outbreak News (`who.int`), NCDC SitReps (`ncdc.gov.ng`), and verified Nigeria
                  emergency feeds. Zero manual upload required.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                <span className="rounded-full bg-success/15 px-2.5 py-1 font-semibold text-success">
                  ● WHO API Live
                </span>
                <span className="rounded-full bg-success/15 px-2.5 py-1 font-semibold text-success">
                  ● NCDC SitRep Scraper Live
                </span>
              </div>
            </div>

            {liveIntelQuery.isLoading && (
              <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Fetching live WHO &amp; NCDC surveillance feeds…
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {filteredIntelItems.map((item) => (
                <article
                  key={item.id}
                  className="command-card flex flex-col justify-between rounded-xl border border-border p-5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${hazardAccentClass(item.hazard)}`}
                      >
                        {hazardLabel(item.hazard)}
                      </span>
                      <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-foreground">
                        {item.source}
                      </span>
                      <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">
                        {item.externalRef}
                      </span>
                    </div>

                    <h3 className="mt-3 font-display text-base font-bold leading-snug text-foreground">
                      {item.headline}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {item.summary}
                    </p>

                    <div className="mt-3 rounded-lg bg-surface p-2.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Guidance: </span>
                      {item.instructions}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground">
                    <span>
                      {item.sourceAgency} · {timeAgo(item.publishedAt)}
                    </span>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                    >
                      Official Report <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
