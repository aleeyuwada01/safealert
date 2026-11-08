import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Code2,
  ExternalLink,
  Lock,
  RadioTower,
  Satellite,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Wifi,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getLiveIntelligence } from "@/lib/live-intel.functions";
import {
  formatCount,
  hazardAccentClass,
  hazardLabel,
  type Hazard,
  type Severity,
} from "@/lib/safealert";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SafeAlert — Be Aware. Stay Safe." },
      {
        name: "description",
        content:
          "Unified multi-hazard emergency warning infrastructure delivering sub-second alerts across cellular broadcast, BulkSMS Nigeria v2, satellite, Wi-Fi, and municipal sirens.",
      },
      { property: "og:title", content: "SafeAlert — Be Aware. Stay Safe." },
      {
        property: "og:description",
        content:
          "Critical emergency warnings and autonomous WHO/NCDC pandemic surveillance delivered in milliseconds.",
      },
    ],
  }),
  component: Landing,
});

const ARCHITECTURE_PILLARS = [
  {
    icon: RadioTower,
    tag: "3GPP TS 23.041 · BulkSMS v2",
    title: "Zero-Congestion Cellular & SMS Fanout",
    description:
      "Broadcasts simultaneously to every handset inside targeted cell towers via 3GPP Cell Broadcast (CMAS/ETWS), backed by BulkSMS Nigeria API v2 (/api/v2/sms & Voice TTS).",
  },
  {
    icon: Satellite,
    tag: "3GPP Rel-17 NTN · L-Band",
    title: "Direct-to-Device Satellite",
    description:
      "Bypasses damaged ground towers during floods or grid failures using LEO/GEO non-terrestrial satellite beams and off-grid community siren controllers.",
  },
  {
    icon: ShieldCheck,
    tag: "WHO · NCDC · CAP 1.2",
    title: "Autonomous Pandemic & Hazard Intel",
    description:
      "Automatically ingests live WHO Disease Outbreak News (Ebola, Mpox, Lassa, Cholera), NCDC SitReps, and Open-Meteo telemetry without manual data uploads.",
  },
];

const LIVE_CHANNELS_PREVIEW = [
  {
    name: "MTN & Airtel Cell Broadcast (CBC)",
    protocol: "3GPP TS 23.041",
    latency: "142 ms",
    status: "200 OK",
  },
  {
    name: "BulkSMS Nigeria v2 (SMS & Voice TTS)",
    protocol: "BSNG-0000 · /api/v2/sms",
    latency: "158 ms",
    status: "200 OK",
  },
  {
    name: "NIGCOMSAT-1R Direct-to-Device Beam",
    protocol: "3GPP Rel-17 NTN",
    latency: "218 ms",
    status: "200 OK",
  },
  {
    name: "Metro Wi-Fi Captive & WebPush",
    protocol: "RFC 8030 VAPID",
    latency: "96 ms",
    status: "200 OK",
  },
  {
    name: "Municipal Acoustic Siren Array",
    protocol: "SIP / RTP + CAP",
    latency: "112 ms",
    status: "200 OK",
  },
];

function Landing() {
  const fetchLiveIntel = useServerFn(getLiveIntelligence);

  const telemetryQuery = useQuery({
    queryKey: ["landing-telemetry"],
    queryFn: async () => {
      const [zonesRes, gatewaysRes, alertsRes] = await Promise.all([
        supabase
          .from("zones")
          .select("id, code, name, region, population_estimate")
          .order("population_estimate", { ascending: false }),
        supabase
          .from("channel_gateways")
          .select("id, name, channel, is_active")
          .eq("is_active", true),
        supabase
          .from("alerts")
          .select("id, hazard, severity, headline, issued_at")
          .in("status", ["live", "broadcasting"])
          .order("issued_at", { ascending: false })
          .limit(1),
      ]);
      return {
        zones: zonesRes.data ?? [],
        gateways: gatewaysRes.data ?? [],
        liveAlerts: (alertsRes.data ?? []) as {
          id: string;
          hazard: Hazard;
          severity: Severity;
          headline: string;
          issued_at: string;
        }[],
      };
    },
    staleTime: 30_000,
  });

  const liveIntelQuery = useQuery({
    queryKey: ["live-autonomous-intel"],
    queryFn: () => fetchLiveIntel(),
    staleTime: 45_000,
  });

  const zones = telemetryQuery.data?.zones ?? [];
  const gateways = telemetryQuery.data?.gateways ?? [];
  const activeAlert = telemetryQuery.data?.liveAlerts?.[0];
  const totalPop = zones.reduce((sum, z) => sum + Number(z.population_estimate ?? 0), 0);
  const liveIntelItems = (liveIntelQuery.data?.items ?? []).slice(0, 4);
  const zoneWeather = liveIntelQuery.data?.zoneWeather ?? [];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SiteHeader />

      {/* Live Emergency Banner */}
      {activeAlert && (
        <div className="border-b border-primary/20 bg-primary/8 px-4 py-2.5 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="pulse-live inline-flex h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                Live Broadcast
              </span>
              <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                {activeAlert.headline}
              </p>
            </div>
            <Link
              to="/alerts"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View alert details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      <main>
        {/* HERO SECTION */}
        <section className="relative overflow-hidden border-b border-border/80 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-45" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              {/* Left Column: Value Proposition */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-2xs">
                  <span className="pulse-healthy inline-block h-2 w-2 rounded-full bg-success" />
                  <span>OASIS CAP 1.2 · WHO &amp; NCDC Live Surveillance</span>
                </div>

                <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
                  Critical emergency warnings, delivered in{" "}
                  <span className="text-primary">milliseconds.</span>
                </h1>

                <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  SafeAlert unifies{" "}
                  <span className="font-semibold text-foreground">
                    3GPP Cell Broadcast, BulkSMS Nigeria v2, Direct-to-Device Satellite, Wi-Fi
                    Push, and IP Sirens
                  </span>{" "}
                  with autonomous real-time pandemic and weather intelligence.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-xl px-6 text-sm font-semibold shadow-sm"
                  >
                    <Link to="/console">
                      Launch Command Console <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl bg-card px-6 text-sm font-semibold"
                  >
                    <Link to="/alerts">
                      <Activity className="mr-2 h-4 w-4 text-primary" /> Live Alerts &amp; WHO Feed
                    </Link>
                  </Button>
                </div>

                {/* Clean Metrics Row */}
                <div className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-8 sm:gap-6">
                  <div>
                    <p className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                      {totalPop > 0 ? formatCount(totalPop) : "25.6M"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Citizens protected
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                      {gateways.length || 7} Live
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      HTTPS &amp; SMS bridges
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                      24/7 Auto
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      WHO &amp; NCDC feeds
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Product Showcase Card */}
              <div className="command-card relative rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <img src="/favicon.svg" alt="SafeAlert" className="h-8 w-8" />
                    <div>
                      <p className="font-display text-sm font-bold text-foreground">
                        Parallel Fanout Engine
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        CAP 1.2 · BulkSMS v2 · HMAC-SHA256
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 font-mono text-[11px] font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> All Gateways Online
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
                  {LIVE_CHANNELS_PREVIEW.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/60 px-3.5 py-3 transition-colors hover:border-border"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {item.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {item.protocol}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
                        <span className="hidden text-muted-foreground sm:inline">
                          {item.latency}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-success/12 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <CheckCircle2 className="h-3 w-3" /> {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-surface px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  <span className="truncate">X-SafeAlert-Signature: sha256=8f4c…e91a</span>
                  <Link
                    to="/console/network"
                    className="shrink-0 font-sans text-xs font-semibold text-primary hover:underline"
                  >
                    Test API →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AUTONOMOUS LIVE PANDEMIC & MULTI-HAZARD SURVEILLANCE SECTION */}
        <section className="border-b border-border bg-surface/30 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-2">
                  <span className="pulse-live inline-block h-2 w-2 rounded-full bg-primary" />
                  <p className="text-eyebrow">Autonomous Real-Time Surveillance</p>
                </div>
                <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Live WHO, NCDC &amp; Meteorological Threat Stream
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  Automatically scrapes and ingests official World Health Organization (WHO)
                  Disease Outbreak News, NCDC Situation Reports, and Open-Meteo zone telemetry with
                  zero manual uploads.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
                <Link to="/alerts">
                  View Full Surveillance Feed <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {zoneWeather.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {zoneWeather.map((zw) => (
                  <div
                    key={zw.zoneCode}
                    className="command-card rounded-xl border border-border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold uppercase text-primary">
                        {zw.zoneCode}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-foreground">
                        <Thermometer className="h-3.5 w-3.5 text-primary" />
                        {zw.temperatureC.toFixed(1)}°C
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-foreground">{zw.zoneName}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                      {zw.conditionLabel}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {liveIntelItems.map((item) => (
                <div
                  key={item.id}
                  className="command-card flex flex-col justify-between rounded-2xl border border-border p-5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${hazardAccentClass(item.hazard)}`}
                      >
                        {hazardLabel(item.hazard)}
                      </span>
                      <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {item.source}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {item.externalRef}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-base font-bold text-foreground">
                      {item.headline}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.summary}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground">
                    <span className="truncate pr-2">{item.sourceAgency}</span>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
                    >
                      Verify Source <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* THREE PILLARS BENTO SECTION */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-eyebrow">Platform Architecture</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Engineered for national-scale resilience
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              One authorized broadcast fans out across terrestrial cellular, BulkSMS Nigeria v2,
              non-terrestrial satellite, and municipal siren infrastructure without single points of
              failure.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ARCHITECTURE_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="command-card flex flex-col justify-between rounded-2xl border border-border p-6 sm:p-7"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <pillar.icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[10px] font-medium text-muted-foreground">
                      {pillar.tag}
                    </span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DEVELOPER & BUSINESS REST API V1 PLATFORM SECTION */}
        <section className="border-y border-border bg-surface/40 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
              <div>
                <p className="text-eyebrow">SafeAlert Public REST API v1</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Built for Developers, Hospitals, Logistics &amp; Enterprises
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Connect your enterprise software, hospital triage dashboard, logistics fleet, or
                  civic app directly to SafeAlert using scoped{" "}
                  <code className="font-mono text-xs text-foreground">sa_live_...</code> API keys
                  and real-time webhooks.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    {
                      icon: Zap,
                      title: "Instant API Key Provisioning (sa_live_ & sa_test_)",
                      text: "Generate production and sandbox keys in seconds from the Developer Portal with per-minute rate quotas and live usage telemetry.",
                    },
                    {
                      icon: Lock,
                      title: "Signed Outbound Business Webhooks (whsec_sa_...)",
                      text: "Subscribe your HTTPS endpoints to receive HMAC-SHA256 signed CAP 1.2 alerts and WHO/NCDC epidemic notifications within 2 seconds.",
                    },
                    {
                      icon: Wifi,
                      title: "Zone-Scoped Queries & Autonomous Health Feeds",
                      text: "Query /api/v1/alerts, /api/v1/intelligence, and /api/v1/zones filtered by Lagos, Abuja, Kano, Rivers, or nationwide.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild className="rounded-xl">
                    <Link to="/developers">
                      Get Developer API Key <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl bg-card">
                    <Link to="/auth" search={{ portal: "developer" } as never}>
                      Partner Sign In
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Clean SafeAlert Public API v1 Code Preview Card */}
              <div className="overflow-hidden rounded-2xl border border-border bg-zinc-950 text-zinc-100 shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 truncate font-mono text-xs text-zinc-400">
                      GET https://safealert.live/api/v1/alerts?zone=LAG-METRO
                    </span>
                  </div>
                  <span className="shrink-0 rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                    HTTP 200 · SA-0000
                  </span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-zinc-300">
                  <code>{`curl -X GET "https://safealert.live/api/v1/alerts?zone=LAG-METRO" \\
  -H "Authorization: Bearer sa_live_acme_8f92a1b4c7d0e3f6..." \\
  -H "Accept: application/json"

# Response (200 OK · X-RateLimit-Limit: 600)
{
  "status": "success",
  "code": "SA-0000",
  "environment": "live",
  "count": 2,
  "data": [
    {
      "id": "eb01a622-2026-4000-8000-000000000622",
      "hazard": "epidemic",
      "severity": "extreme",
      "headline": "WHO & NCDC Ebola Virus Surveillance Alert — Nigeria",
      "zones": [{ "code": "LAG-METRO", "name": "Lagos Metropolitan" }]
    }
  ]
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* CLEAN ENTERPRISE CTA */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="command-card flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-card p-6 sm:p-10 md:flex-row md:items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Ready for Operations
              </div>
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                Experience the SafeAlert Command Console
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Author CAP 1.2 broadcasts, test BulkSMS Nigeria v2 sandbox &amp; production routes,
                and monitor autonomous WHO/NCDC pandemic intelligence.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="lg" className="rounded-xl px-6 font-semibold">
                <Link to="/console">
                  Open Command Console <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl px-6 font-semibold"
              >
                <Link to="/alerts">Public Alert Feed</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
