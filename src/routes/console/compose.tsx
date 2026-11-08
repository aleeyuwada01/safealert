import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { issueAlert } from "@/lib/alerts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CHANNELS,
  DRILL_TEMPLATES,
  HAZARDS,
  LANGUAGES,
  SEVERITIES,
  buildCapXmlDocument,
  channelLabel,
  formatCount,
  hazardLabel,
  severityLabel,
  type ChannelKind,
  type DrillTemplate,
  type Hazard,
  type Severity,
} from "@/lib/safealert";

export const Route = createFileRoute("/console/compose")({
  head: () => ({
    meta: [
      { title: "Issue Alert — SafeAlert Console" },
      {
        name: "description",
        content:
          "Compose and broadcast a multi-hazard emergency alert across cellular, satellite, Wi-Fi and siren channels to selected coverage zones.",
      },
      { property: "og:title", content: "Issue Alert — SafeAlert Console" },
      {
        property: "og:description",
        content: "Compose and broadcast an emergency alert across every available channel.",
      },
    ],
  }),
  component: Compose,
});

function Compose() {
  const navigate = useNavigate();
  const issue = useServerFn(issueAlert);

  const [hazard, setHazard] = useState<Hazard>("flood");
  const [severity, setSeverity] = useState<Severity>("warning");
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [channels, setChannels] = useState<ChannelKind[]>([
    "cell_broadcast",
    "sms",
    "satellite",
    "wifi_push",
  ]);
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [sirenEnabled, setSirenEnabled] = useState(true);
  const [expiresInHours, setExpiresInHours] = useState(6);
  const [evacuationMapUrl, setEvacuationMapUrl] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [previewTab, setPreviewTab] = useState<"handset" | "xml" | "json">("handset");
  const [error, setError] = useState<string | null>(null);

  const zonesQuery = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zones")
        .select("id, code, name, population_estimate")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () =>
      issue({
        data: {
          hazard,
          severity,
          headline,
          message,
          instructions: instructions || null,
          languages,
          sirenEnabled,
          zoneIds,
          channels,
          expiresInHours,
          evacuationMapUrl: evacuationMapUrl.trim() || null,
          requireApproval,
        },
      }),
    onSuccess: (res) => {
      if (res.status === "pending_approval") {
        toast.success("Alert submitted to Two-Person Approval Queue.");
      } else {
        toast.success(`Alert broadcast to ${formatCount(res.reached)} devices.`);
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  function applyTemplate(tpl: DrillTemplate) {
    setHazard(tpl.hazard);
    setSeverity(tpl.severity);
    setHeadline(tpl.headline);
    setMessage(tpl.message);
    setInstructions(tpl.instructions);
    setLanguages(tpl.languages);
    setSirenEnabled(tpl.sirenEnabled);
    setExpiresInHours(tpl.expiresInHours);
    const firstZone = zonesQuery.data?.[0];
    if (zoneIds.length === 0 && firstZone) {
      setZoneIds([firstZone.id]);
    }
    toast.info(`Loaded preset template: ${tpl.title}`);
  }

  function toggle<T>(list: T[], value: T, set: (next: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const selectedZones = (zonesQuery.data ?? []).filter((z) => zoneIds.includes(z.id));
  const population = selectedZones.reduce((s, z) => s + Number(z.population_estimate ?? 0), 0);
  const result = mutation.data;

  const capXmlPreview = buildCapXmlDocument({
    id: "PREVIEW-CAP-1.2",
    hazard,
    severity,
    headline: headline || "EMERGENCY WARNING HEADLINE",
    message: message || "Emergency warning description will appear here.",
    instructions: instructions || null,
    languages,
    zones: selectedZones.map((z) => ({ code: z.code, name: z.name })),
  });

  if (result) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="command-card rounded-xl border border-border p-8">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <p className="text-eyebrow">
              {result.status === "pending_approval"
                ? "Staged for Authorization"
                : "Live HTTP Fanout Complete"}
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-bold uppercase sm:text-3xl">
            Alert {result.status.replace(/_/g, " ")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.status === "pending_approval"
              ? `Staged for ${formatCount(result.targeted)} citizens. Awaiting second-operator approval on the Command Dashboard.`
              : `${formatCount(result.reached)} of ${formatCount(result.targeted)} targeted devices confirmed across ${result.results.length} live gateway dispatches.`}
          </p>

          {result.results.length > 0 && (
            <div className="mt-6 space-y-2">
              {result.results.map((r, i) => (
                <div
                  key={`${r.channel}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{channelLabel(r.channel)}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {r.status} · {r.latencyMs} ms · {formatCount(r.devicesReached)} reached
                      {r.gatewayReference ? ` · Ref: ${r.gatewayReference}` : ""}
                    </p>
                  </div>
                  {r.errorDetail ? (
                    <span className="font-mono text-xs text-destructive">{r.errorDetail}</span>
                  ) : (
                    <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase text-success">
                      HTTP 200 OK
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => navigate({ to: "/console" })}>Back to Dashboard</Button>
            <Button variant="outline" onClick={() => mutation.reset()}>
              Issue Another Alert
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Alert Authoring &amp; CAP 1.2 Dispatcher</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Issue Emergency Alert
          </h1>
        </div>
      </div>

      {/* Quick Scenario Presets */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Quick-Load Templates
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {DRILL_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="rounded-lg border border-border bg-surface/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60"
            >
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
                {hazardLabel(tpl.hazard)} · {tpl.severity}
              </span>
              <p className="mt-1 text-xs font-semibold text-foreground">{tpl.title}</p>
            </button>
          ))}
        </div>
      </div>

      <form
        className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (zoneIds.length === 0) {
            setError("Select at least one coverage zone.");
            return;
          }
          if (channels.length === 0) {
            setError("Select at least one delivery channel.");
            return;
          }
          mutation.mutate();
        }}
      >
        <div className="command-card space-y-5 rounded-xl border border-border p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hazard">Hazard Category</Label>
              <select
                id="hazard"
                value={hazard}
                onChange={(e) => setHazard(e.target.value as Hazard)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {HAZARDS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Severity Class</Label>
              <select
                id="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.note}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">Headline (Cell Broadcast Banner)</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="FLOOD WARNING: Ogun River rising rapidly"
              required
              minLength={6}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Warning Message Body</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
              minLength={10}
              maxLength={1200}
              placeholder="Water levels will exceed flood stage within 3 hours in low-lying districts."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Protective Action Instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder="Move to higher ground immediately. Do not attempt to cross flooded roads."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evacuationMapUrl">Evacuation Map Link (optional)</Label>
            <Input
              id="evacuationMapUrl"
              type="url"
              value={evacuationMapUrl}
              onChange={(e) => setEvacuationMapUrl(e.target.value)}
              maxLength={500}
              placeholder="https://maps.nema.gov.ng/evac/zone-corridor"
            />
          </div>

          <fieldset className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold">Target Coverage Zones</legend>
              <button
                type="button"
                className="font-mono text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  const allIds = (zonesQuery.data ?? []).map((z) => z.id);
                  setZoneIds(zoneIds.length === allIds.length ? [] : allIds);
                }}
              >
                {zoneIds.length === (zonesQuery.data ?? []).length && zoneIds.length > 0
                  ? "Clear all"
                  : "Select all"}
              </button>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(zonesQuery.data ?? []).map((zone) => (
                <label
                  key={zone.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface/50 px-3 py-2.5 text-sm transition-colors hover:border-primary/40"
                >
                  <Checkbox
                    checked={zoneIds.includes(zone.id)}
                    onCheckedChange={() => toggle(zoneIds, zone.id, setZoneIds)}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{zone.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{zone.code}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatCount(Number(zone.population_estimate ?? 0))}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="space-y-5">
          {/* Live Handset & CAP 1.2 Preview */}
          <div className="command-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <Smartphone className="h-3.5 w-3.5" /> Broadcast Preview
              </span>
              <div className="flex gap-1">
                {(["handset", "xml", "json"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPreviewTab(tab)}
                    className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium uppercase ${
                      previewTab === tab
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {previewTab === "handset" && (
              <div className="mt-3.5 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-signal" />
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-signal">
                      {severity === "extreme"
                        ? "PRESIDENTIAL EXTREME ALERT"
                        : `NATIONAL ${severityLabel(severity).toUpperCase()} ALERT`}
                    </span>
                  </div>
                  {sirenEnabled && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-primary">
                      <Volume2 className="h-3 w-3" /> 853/960Hz
                    </span>
                  )}
                </div>
                <p className="mt-2.5 font-display text-sm font-bold text-foreground">
                  {headline || "EMERGENCY HEADLINE PREVIEW"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {message ||
                    "Your emergency broadcast message body will appear on every handset in the targeted cell broadcast area."}
                </p>
                {instructions && (
                  <p className="mt-2.5 rounded-md bg-warning/15 px-2.5 py-1.5 text-xs font-medium text-warning">
                    Action: {instructions}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>NEMA · SafeAlert ({languages.join("/").toUpperCase()})</span>
                  <span>
                    {selectedZones.length > 0
                      ? selectedZones.map((z) => z.code).join(", ")
                      : "No zone selected"}
                  </span>
                </div>
              </div>
            )}

            {previewTab === "xml" && (
              <pre className="mt-3 max-h-52 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                <code>{capXmlPreview}</code>
              </pre>
            )}

            {previewTab === "json" && (
              <pre className="mt-3 max-h-52 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {JSON.stringify(
                  {
                    sender: "alerts@safealert.live",
                    status: "Actual",
                    msgType: "Alert",
                    scope: "Public",
                    info: {
                      language: languages[0] ?? "en",
                      category: hazard === "security_threat" ? "Security" : "Met",
                      event: headline || "(Headline)",
                      urgency: severity === "advisory" ? "Future" : "Immediate",
                      severity,
                      headline: headline || "(Headline)",
                      description: message || "(Message body)",
                      instruction: instructions || null,
                      web: evacuationMapUrl || null,
                      area: selectedZones.map((z) => ({
                        areaDesc: z.name,
                        geocode: z.code,
                      })),
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            )}
          </div>

          <fieldset className="command-card space-y-3 rounded-xl border border-border p-5">
            <legend className="px-1 text-sm font-semibold">Delivery Channels</legend>
            {CHANNELS.map((channel) => (
              <label key={channel.value} className="flex cursor-pointer items-start gap-3 text-sm">
                <Checkbox
                  checked={channels.includes(channel.value)}
                  onCheckedChange={() => toggle(channels, channel.value, setChannels)}
                />
                <span>
                  <span className="font-medium">{channel.label}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {channel.transport} · {channel.protocol}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="command-card space-y-3 rounded-xl border border-border p-5">
            <legend className="px-1 text-sm font-semibold">Languages &amp; Options</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {LANGUAGES.map((language) => (
                <label
                  key={language.code}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <Checkbox
                    checked={languages.includes(language.code)}
                    onCheckedChange={() => toggle(languages, language.code, setLanguages)}
                  />
                  {language.label}
                </label>
              ))}
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={sirenEnabled}
                  onCheckedChange={(v) => setSirenEnabled(Boolean(v))}
                />
                Sound audible siren override on handsets
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={requireApproval}
                  onCheckedChange={(v) => setRequireApproval(Boolean(v))}
                />
                <span>
                  Require Two-Person Authorization
                  <span className="block text-xs text-muted-foreground">
                    Stages alert in approval queue before live HTTP fanout
                  </span>
                </span>
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="expiry">Expires in (hours)</Label>
                <Input
                  id="expiry"
                  type="number"
                  min={1}
                  max={168}
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                />
              </div>
            </div>
          </fieldset>

          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Estimated Citizens Targeted
              </span>
              <span className="font-mono text-xs text-primary">
                {selectedZones.length} zone(s)
              </span>
            </div>
            <p className="mt-1 font-display text-2xl font-bold">{formatCount(population)}</p>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={mutation.isPending}>
            {requireApproval ? (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {mutation.isPending ? "Submitting…" : "Stage for Two-Person Approval"}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {mutation.isPending ? "Broadcasting…" : "Authorize & Broadcast Live"}
              </>
            )}
          </Button>
        </aside>
      </form>
    </main>
  );
}
