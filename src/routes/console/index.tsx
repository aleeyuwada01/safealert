import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Thermometer,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { approveAlert, cancelAlert, issueAlert } from "@/lib/alerts.functions";
import { getLiveIntelligence, syncLiveIntelligence } from "@/lib/live-intel.functions";
import type { AutonomousIntelItem } from "@/lib/live-intel.server";
import { Button } from "@/components/ui/button";
import {
  CHANNELS,
  buildCapXmlDocument,
  channelLabel,
  formatCount,
  hazardAccentClass,
  hazardLabel,
  severityLabel,
  statusClass,
  statusLabel,
  type AlertStatus,
  type ChannelKind,
  type DeliveryStatus,
  type Hazard,
  type Severity,
} from "@/lib/safealert";

export const Route = createFileRoute("/console/")({
  head: () => ({
    meta: [
      { title: "Command Dashboard — SafeAlert Console" },
      {
        name: "description",
        content:
          "Live view of broadcasting alerts, autonomous WHO/NCDC pandemic surveillance, per-channel delivery metrics and gateway health.",
      },
      { property: "og:title", content: "Command Dashboard — SafeAlert Console" },
      {
        property: "og:description",
        content: "Live alerts, autonomous surveillance, and gateway health for SafeAlert operators.",
      },
    ],
  }),
  component: Dashboard,
});

type ConsoleAlert = {
  id: string;
  hazard: Hazard;
  severity: Severity;
  status: AlertStatus;
  headline: string;
  message: string;
  instructions: string | null;
  languages: string[];
  issued_at: string | null;
  expires_at: string | null;
  alert_zones: { zones: { code: string; name: string } | null }[];
  alert_deliveries: {
    channel: ChannelKind;
    status: DeliveryStatus;
    devices_reached: number | null;
    devices_targeted: number | null;
    latency_ms: number | null;
  }[];
  alert_acknowledgements: {
    id: string;
  }[];
};

function Dashboard() {
  const queryClient = useQueryClient();
  const cancel = useServerFn(cancelAlert);
  const approve = useServerFn(approveAlert);
  const issue = useServerFn(issueAlert);
  const fetchLiveIntel = useServerFn(getLiveIntelligence);
  const runSyncLiveIntel = useServerFn(syncLiveIntelligence);

  const [inspectCapId, setInspectCapId] = useState<string | null>(null);
  const [showAutonomousPanel, setShowAutonomousPanel] = useState<boolean>(true);
  const [syncingSources, setSyncingSources] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  async function handleSyncSources() {
    setSyncingSources(true);
    try {
      const res = await runSyncLiveIntel();
      queryClient.setQueryData(["live-autonomous-intel"], res.feed);
      await queryClient.invalidateQueries({ queryKey: ["console-alerts"] });
      setLastSyncedAt(res.syncedAt);
      toast.success(
        `Synced ${res.onlineSourcesCount}/4 live sources (WHO, NCDC, RSS, Open-Meteo) · ${res.feed.items.length} signals (${res.syncedAlertsCount} DB alerts synced)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync live sources");
    } finally {
      setSyncingSources(false);
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel("console-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["console-alerts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alert_deliveries" }, () => {
        queryClient.invalidateQueries({ queryKey: ["console-alerts"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alert_acknowledgements" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["console-alerts"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, () => {
        queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const alertsQuery = useQuery({
    queryKey: ["console-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select(
          "id, hazard, severity, status, headline, message, instructions, languages, issued_at, expires_at, alert_zones(zones(code, name)), alert_deliveries(channel, status, devices_reached, devices_targeted, latency_ms), alert_acknowledgements(id)",
        )
        .order("issued_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ConsoleAlert[];
    },
    refetchInterval: 20_000,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zones")
        .select("id, code, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const gatewaysQuery = useQuery({
    queryKey: ["gateways"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_gateways")
        .select("id, name, channel, operator_name, region, is_active, health, endpoint")
        .order("channel");
      if (error) throw error;
      return data ?? [];
    },
  });

  const auditQuery = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, alert_id, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const liveIntelQuery = useQuery({
    queryKey: ["live-autonomous-intel"],
    queryFn: () => fetchLiveIntel(),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (alertId: string) => cancel({ data: { alertId } }),
    onSuccess: () => {
      toast.success("Alert cancelled and logged to audit trail.");
      queryClient.invalidateQueries({ queryKey: ["console-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: (alertId: string) => approve({ data: { alertId } }),
    onSuccess: (res) => {
      toast.success(`Alert approved and broadcast to ${formatCount(res.reached)} devices.`);
      queryClient.invalidateQueries({ queryKey: ["console-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const broadcastIntelMutation = useMutation({
    mutationFn: async (item: AutonomousIntelItem) => {
      const allZoneIds = (zonesQuery.data ?? []).map((z) => z.id);
      if (allZoneIds.length === 0) {
        throw new Error("No coverage zones available.");
      }
      return issue({
        data: {
          hazard: item.hazard,
          severity: item.severity,
          headline: item.headline.slice(0, 120),
          message: item.summary.slice(0, 1200),
          instructions: item.instructions.slice(0, 600),
          languages: ["en", "ha", "yo", "ig", "pcm"],
          sirenEnabled: item.severity === "extreme",
          zoneIds: allZoneIds,
          channels: ["cell_broadcast", "sms", "satellite", "wifi_push"],
          expiresInHours: 24,
          evacuationMapUrl: item.sourceUrl,
          requireApproval: false,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        `Autonomous report escalated & broadcast live to ${formatCount(res.reached)} devices!`,
      );
      queryClient.invalidateQueries({ queryKey: ["console-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const alerts = alertsQuery.data ?? [];
  const gateways = gatewaysQuery.data ?? [];
  const pendingAlerts = alerts.filter((a) => a.status === "pending_approval");
  const liveAlerts = alerts.filter((a) => a.status === "live" || a.status === "broadcasting");
  const totalReached = alerts.reduce(
    (sum, a) => sum + a.alert_deliveries.reduce((s, d) => s + (d.devices_reached ?? 0), 0),
    0,
  );
  const totalAcks = alerts.reduce((sum, a) => sum + (a.alert_acknowledgements?.length ?? 0), 0);
  const avgLatency = (() => {
    const values = alerts.flatMap((a) =>
      a.alert_deliveries.map((d) => d.latency_ms).filter((v): v is number => typeof v === "number"),
    );
    if (values.length === 0) return 0;
    return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  })();

  const channelStats = CHANNELS.map((c) => {
    const rows = alerts.flatMap((a) =>
      a.alert_deliveries.filter((d) => d.channel === c.value),
    );
    const reached = rows.reduce((s, r) => s + (r.devices_reached ?? 0), 0);
    const targeted = rows.reduce((s, r) => s + (r.devices_targeted ?? 0), 0);
    const rate = targeted > 0 ? Math.min(100, Math.round((reached / targeted) * 100)) : 0;
    const activeGwCount = gateways.filter(
      (g) => g.channel === c.value && g.is_active && Boolean(g.endpoint),
    ).length;
    return {
      ...c,
      dispatches: rows.length,
      reached,
      rate,
      activeGwCount,
    };
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-eyebrow">National Command Overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Operations Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAutonomousPanel((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 font-mono text-xs font-medium transition-colors ${
              showAutonomousPanel
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            {showAutonomousPanel ? "Live WHO/NCDC Intel: ON" : "Live WHO/NCDC Intel: OFF"}
          </button>
          <Button asChild variant="outline" size="sm">
            <Link to="/console/network">Network &amp; BulkSMS v2</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/console/compose">
              <Send className="mr-2 h-4 w-4" /> Issue Alert
            </Link>
          </Button>
        </div>
      </div>

      {/* Clean 4-Card KPI Strip */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Activity,
            label: "Active Broadcasts",
            value: String(liveAlerts.length),
            sub:
              pendingAlerts.length > 0
                ? `${pendingAlerts.length} awaiting approval`
                : `${(liveIntelQuery.data?.items ?? []).length} live WHO/NCDC signals`,
          },
          {
            icon: Users,
            label: "Devices Reached",
            value: formatCount(totalReached),
            sub: `${formatCount(totalAcks)} citizen receipts`,
          },
          {
            icon: Radio,
            label: "Active Gateways",
            value: `${gateways.filter((g) => g.is_active).length} / ${gateways.length}`,
            sub: "HTTPS & BulkSMS v2 bridges",
          },
          {
            icon: CheckCircle2,
            label: "Avg Dispatch Latency",
            value: avgLatency > 0 ? `${avgLatency} ms` : "—",
            sub: "Real HTTP round-trip",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="command-card rounded-xl border border-border p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
              <metric.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold tracking-tight">{metric.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.sub}</p>
          </div>
        ))}
      </div>

      {/* Optional Autonomous WHO, NCDC & Open-Meteo Surveillance Panel */}
      {showAutonomousPanel && (
        <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="pulse-live inline-block h-2 w-2 rounded-full bg-primary" />
                <h2 className="font-display text-base font-bold">
                  Autonomous Pandemic &amp; Multi-Hazard Surveillance (WHO · NCDC · Open-Meteo)
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Operates independently and automatically from live WHO Disease Outbreak News, NCDC
                SitReps, and Open-Meteo APIs without requiring manual uploads.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleSyncSources}
              disabled={syncingSources || liveIntelQuery.isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${
                  syncingSources || liveIntelQuery.isFetching ? "animate-spin" : ""
                }`}
              />
              {syncingSources ? "Syncing WHO & NCDC…" : "Sync Live Sources"}
            </Button>
          </div>

          {liveIntelQuery.data && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-surface/50 px-3 py-1.5 font-mono text-[11px]">
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { label: "WHO API", ok: liveIntelQuery.data.sourcesOnline.whoApi },
                  { label: "NCDC SitRep", ok: liveIntelQuery.data.sourcesOnline.ncdcScraper },
                  { label: "Nigeria RSS", ok: liveIntelQuery.data.sourcesOnline.nigeriaRss },
                  { label: "Open-Meteo", ok: liveIntelQuery.data.sourcesOnline.openMeteo },
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

          {/* Zone Weather Strip */}
          {(liveIntelQuery.data?.zoneWeather ?? []).length > 0 && (
            <div className="mt-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {(liveIntelQuery.data?.zoneWeather ?? []).map((zw) => (
                <div
                  key={zw.zoneCode}
                  className="flex items-center justify-between rounded-lg border border-border/80 bg-surface/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] font-semibold text-primary">
                      {zw.zoneCode}
                    </span>
                    <p className="truncate text-xs font-medium text-foreground">{zw.zoneName}</p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-foreground">
                      <Thermometer className="h-3 w-3 text-primary" />
                      {zw.temperatureC.toFixed(1)}°C
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {zw.precipitationMm}mm rain
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Top Live WHO / NCDC Outbreak Signals */}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(liveIntelQuery.data?.items ?? []).slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-surface/40 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${hazardAccentClass(item.hazard)}`}
                    >
                      {hazardLabel(item.hazard)}
                    </span>
                    <span className="rounded border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {item.source}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {item.externalRef}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold leading-snug text-foreground">
                    {item.headline}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-primary hover:underline"
                  >
                    Source ({item.sourceAgency.slice(0, 22)}) <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                    disabled={broadcastIntelMutation.isPending}
                    onClick={() => broadcastIntelMutation.mutate(item)}
                  >
                    <Send className="mr-1.5 h-3 w-3 text-primary" /> Broadcast to Grid
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending Two-Person Approval Queue */}
      {pendingAlerts.length > 0 && (
        <section className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-warning">
                Pending Two-Person Authorization ({pendingAlerts.length})
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Requires second-operator approval before live HTTP fanout to telecom and satellite gateways.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {pendingAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${hazardAccentClass(alert.hazard)}`}
                    >
                      {hazardLabel(alert.hazard)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {severityLabel(alert.severity)}
                    </span>
                  </div>
                  <p className="mt-1.5 font-semibold">{alert.headline}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(alert.id)}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve &amp; Broadcast
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(alert.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Left Column: Broadcast Stream */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Broadcast History</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {alerts.length} recent dispatches
            </span>
          </div>

          {alertsQuery.isLoading && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading broadcast history…
            </div>
          )}

          {!alertsQuery.isLoading && alerts.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No alerts issued yet.
            </div>
          )}

          <div className="space-y-3">
            {alerts.map((alert) => {
              const reached = alert.alert_deliveries.reduce(
                (s, d) => s + (d.devices_reached ?? 0),
                0,
              );
              const acks = alert.alert_acknowledgements?.length ?? 0;
              const isInspecting = inspectCapId === alert.id;
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
                zones: (alert.alert_zones ?? [])
                  .map((z) => z.zones)
                  .filter((z): z is { code: string; name: string } => Boolean(z)),
              });

              return (
                <article
                  key={alert.id}
                  className="command-card rounded-xl border border-border p-5"
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
                    <span className="font-mono text-[11px] uppercase text-muted-foreground">
                      {severityLabel(alert.severity)}
                    </span>

                    <div className="ml-auto flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 font-mono text-[11px]"
                        onClick={() => setInspectCapId(isInspecting ? null : alert.id)}
                      >
                        <Code2 className="mr-1 h-3.5 w-3.5" /> CAP 1.2 XML
                      </Button>
                      {(alert.status === "live" || alert.status === "broadcasting") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(alert.id)}
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  <h3 className="mt-2.5 text-base font-bold text-foreground">{alert.headline}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>

                  {alert.alert_deliveries.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {alert.alert_deliveries.map((delivery, i) => (
                        <span
                          key={`${alert.id}-${delivery.channel}-${i}`}
                          className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                        >
                          {channelLabel(delivery.channel)} · {delivery.status}
                          {delivery.latency_ms ? ` (${delivery.latency_ms}ms)` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatCount(reached)} reached
                    </span>
                    <span>·</span>
                    <span className="font-medium text-primary">{acks} citizen receipts</span>
                    {alert.alert_zones?.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[11px]">
                          {alert.alert_zones
                            .map((z) => z.zones?.code)
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </>
                    )}
                  </div>

                  {isInspecting && (
                    <div className="mt-3 rounded-lg border border-border bg-surface p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                          OASIS CAP 1.2 XML Payload
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 font-mono text-[10px]"
                          onClick={() => {
                            navigator.clipboard.writeText(capXml);
                            toast.success("CAP 1.2 XML copied.");
                          }}
                        >
                          <Copy className="mr-1 h-3 w-3" /> Copy
                        </Button>
                      </div>
                      <pre className="mt-2 max-h-48 overflow-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
                        <code>{capXml}</code>
                      </pre>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Right Column: Transport Telemetry, Registered Gateways & Audit Trail */}
        <aside className="space-y-6">
          <section className="command-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Transport Delivery Status</h2>
              <Link
                to="/console/network"
                className="font-mono text-[11px] font-medium text-primary hover:underline"
              >
                Configure →
              </Link>
            </div>
            <div className="mt-4 space-y-3.5">
              {channelStats.map((stat) => (
                <div key={stat.value} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{stat.label}</span>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-muted-foreground">
                        {formatCount(stat.reached)} ({stat.rate}%)
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          stat.activeGwCount > 0
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning"
                        }`}
                      >
                        {stat.activeGwCount > 0 ? `${stat.activeGwCount} Live` : "No Endpoint"}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(6, stat.rate)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="command-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Active Provider Gateways</h2>
              <Link
                to="/console/network"
                className="font-mono text-[11px] font-medium text-primary hover:underline"
              >
                Test API →
              </Link>
            </div>
            <div className="mt-3 divide-y divide-border/70">
              {gateways.slice(0, 6).map((gateway) => (
                <div
                  key={gateway.id}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-sm font-medium text-foreground">{gateway.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {gateway.operator_name} · {gateway.region}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${
                      gateway.health === "healthy"
                        ? "bg-success/15 text-success"
                        : gateway.health === "degraded"
                          ? "bg-warning/15 text-warning"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {gateway.health}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="command-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="font-display text-base font-bold">Recent Audit Trail</h2>
            </div>
            <div className="mt-3 space-y-2">
              {(auditQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No operator actions recorded yet.</p>
              ) : (
                (auditQuery.data ?? []).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface/60 px-3 py-2 font-mono text-[11px]"
                  >
                    <span className="truncate font-medium text-foreground">{entry.action}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
