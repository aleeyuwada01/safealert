import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CheckCircle2,
  Code2,
  Copy,
  MapPin,
  MessageSquare,
  Play,
  Plus,
  Radio,
  Shield,
  Trash2,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { SmartSmsManager } from "@/components/smart-sms-manager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import {
  checkBulkSmsNigeriaBalance,
  simulateBulkSmsDeliveryWebhook,
  testBulkSmsNigeria,
  testGateway,
} from "@/lib/alerts.functions";
import type {
  BulkSmsBalanceReport,
  BulkSmsTestReport,
  GatewayTestReport,
} from "@/lib/dispatch.server";
import {
  BSNG_ERROR_CODES,
  BULKSMS_NIGERIA_BASE_URLS,
  type BulkSmsEnvironment,
  type BulkSmsGatewayRoute,
} from "@/lib/bulksms-nigeria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CHANNELS, channelLabel, formatCount, type ChannelKind } from "@/lib/safealert";

export const Route = createFileRoute("/console/network")({
  head: () => ({
    meta: [
      { title: "Network, Gateways & BulkSMS Nigeria v2 — SafeAlert Console" },
      {
        name: "description",
        content:
          "Test BulkSMS Nigeria API v2 (Production & Sandbox), telecom & satellite webhooks, coverage zones, and operator roles.",
      },
    ],
  }),
  component: NetworkAdminPage,
});

function NetworkAdminPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const runGatewayTest = useServerFn(testGateway);
  const runBulkSmsTest = useServerFn(testBulkSmsNigeria);
  const runBulkSmsBalance = useServerFn(checkBulkSmsNigeriaBalance);
  const runBulkSmsWebhook = useServerFn(simulateBulkSmsDeliveryWebhook);

  const [activeSection, setActiveSection] = useState<
    "directory" | "bulksms" | "gateways" | "zones" | "operators"
  >("directory");

  // BulkSMS Nigeria v2 State
  const [bsngEnv, setBsngEnv] = useState<BulkSmsEnvironment>("sandbox");
  const [bsngMode, setBsngMode] = useState<"sms" | "voice">("sms");
  const [bsngToken, setBsngToken] = useState("");
  const [bsngFrom, setBsngFrom] = useState("SafeAlert");
  const [bsngTo, setBsngTo] = useState("2347037770033,2349050030090");
  const [bsngBody, setBsngBody] = useState(
    "EMERGENCY ALERT: High water levels reported in your zone. Move to higher ground immediately. -SafeAlert",
  );
  const [bsngGateway, setBsngGateway] = useState<BulkSmsGatewayRoute>("direct-refund");
  const [bsngUnicode, setBsngUnicode] = useState(false);
  const [bsngCallbackUrl, setBsngCallbackUrl] = useState("");
  const [bsngCustomerRef, setBsngCustomerRef] = useState("SAFEALERT-DRILL-01");
  const [bsngReport, setBsngReport] = useState<BulkSmsTestReport | null>(null);
  const [bsngBalance, setBsngBalance] = useState<BulkSmsBalanceReport | null>(null);

  // Delivery Webhook Tester State
  const [dlrMessageId, setDlrMessageId] = useState("sandbox-d0173d84-2f01-4a5f-a0dc-375beea5b806");
  const [dlrRecipient, setDlrRecipient] = useState("2347037770033");
  const [dlrStatus, setDlrStatus] = useState("delivrd");

  // Generic CAP 1.2 Gateway Probe State
  const [testChannel, setTestChannel] = useState<ChannelKind>("cell_broadcast");
  const [testEndpoint, setTestEndpoint] = useState("");
  const [testZoneCode, setTestZoneCode] = useState("LAG-METRO");
  const [testReport, setTestReport] = useState<GatewayTestReport | null>(null);
  const [reportTab, setReportTab] = useState<"payload" | "capxml" | "headers" | "response">(
    "payload",
  );

  // New Zone state
  const [zoneCode, setZoneCode] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [zoneRegion, setZoneRegion] = useState("");
  const [zonePop, setZonePop] = useState("");
  const [zoneLat, setZoneLat] = useState("");
  const [zoneLng, setZoneLng] = useState("");

  // New Gateway state
  const [gwChannel, setGwChannel] = useState<ChannelKind>("cell_broadcast");
  const [gwName, setGwName] = useState("");
  const [gwOperator, setGwOperator] = useState("");
  const [gwProtocol, setGwProtocol] = useState("3GPP CBS / CMAS");
  const [gwEndpoint, setGwEndpoint] = useState("");
  const [gwRegion, setGwRegion] = useState("National");

  const zonesQuery = useQuery({
    queryKey: ["zones-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zones")
        .select("id, code, name, region, population_estimate, centre_lat, centre_lng")
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
        .select(
          "id, channel, name, operator_name, protocol, endpoint, region, is_active, health, last_heartbeat_at",
        )
        .order("channel");
      if (error) throw error;
      return data ?? [];
    },
  });

  const operatorsQuery = useQuery({
    queryKey: ["operators-admin"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, agency, created_at").order("created_at"),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  const bulkSmsMutation = useMutation({
    mutationFn: () =>
      runBulkSmsTest({
        data: {
          environment: bsngEnv,
          mode: bsngMode,
          apiToken: bsngToken.trim() || null,
          from: bsngFrom,
          to: bsngTo,
          body: bsngBody,
          gateway: bsngGateway,
          unicode: bsngUnicode,
          callbackUrl: bsngCallbackUrl.trim() || null,
          customerReference: bsngCustomerRef.trim() || null,
        },
      }),
    onSuccess: (report) => {
      setBsngReport(report);
      if (report.messageId) {
        setDlrMessageId(report.messageId);
      }
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      if (report.ok) {
        toast.success(`${report.bsngCode}: ${report.message}`);
      } else {
        toast.error(`${report.bsngCode} (${report.bsngCategory}): ${report.bsngDescription}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const balanceMutation = useMutation({
    mutationFn: () =>
      runBulkSmsBalance({
        data: {
          environment: bsngEnv,
          apiToken: bsngToken.trim() || null,
        },
      }),
    onSuccess: (res) => {
      setBsngBalance(res);
      if (res.ok) {
        toast.success(`Wallet Balance: ${res.formatted ?? `${res.balance} ${res.currency}`}`);
      } else {
        toast.error(`${res.bsngCode}: ${res.bsngDescription}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dlrWebhookMutation = useMutation({
    mutationFn: () =>
      runBulkSmsWebhook({
        data: {
          message_id: dlrMessageId,
          recipient: dlrRecipient,
          delivery_status: dlrStatus,
          customer_reference: bsngCustomerRef || null,
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["console-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      toast.success(
        `Webhook processed: status "${res.rawDeliveryStatus}" mapped to "${res.mappedStatus.toUpperCase()}"`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const probeMutation = useMutation({
    mutationFn: async (params: {
      gatewayId?: string | null;
      channel: ChannelKind;
      endpointUrl?: string | null;
      zoneCode?: string;
      zoneName?: string;
    }) => runGatewayTest({ data: params }),
    onSuccess: (report) => {
      setTestReport(report);
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      if (report.ok) {
        toast.success(
          `Live HTTP probe succeeded (HTTP ${report.statusCode} · ${report.latencyMs}ms)`,
        );
      } else {
        toast.error(`Gateway test failed: ${report.responsePreview}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addZoneMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("zones").insert({
        code: zoneCode.trim().toUpperCase(),
        name: zoneName.trim(),
        region: zoneRegion.trim() || null,
        population_estimate: Number(zonePop) || 0,
        centre_lat: zoneLat ? Number(zoneLat) : null,
        centre_lng: zoneLng ? Number(zoneLng) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coverage zone added.");
      setZoneCode("");
      setZoneName("");
      setZoneRegion("");
      setZonePop("");
      setZoneLat("");
      setZoneLng("");
      queryClient.invalidateQueries({ queryKey: ["zones-admin"] });
      queryClient.invalidateQueries({ queryKey: ["zones"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone removed.");
      queryClient.invalidateQueries({ queryKey: ["zones-admin"] });
      queryClient.invalidateQueries({ queryKey: ["zones"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addGatewayMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("channel_gateways").insert({
        channel: gwChannel,
        name: gwName.trim(),
        operator_name: gwOperator.trim() || null,
        protocol: gwProtocol.trim(),
        endpoint: gwEndpoint.trim() || null,
        region: gwRegion.trim() || "National",
        is_active: true,
        health: "healthy",
        last_heartbeat_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gateway registered.");
      setGwName("");
      setGwOperator("");
      setGwEndpoint("");
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleGatewayMutation = useMutation({
    mutationFn: async ({
      id,
      is_active,
      health,
    }: {
      id: string;
      is_active: boolean;
      health: string;
    }) => {
      const { error } = await supabase
        .from("channel_gateways")
        .update({
          is_active,
          health,
          last_heartbeat_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gateway updated.");
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
      hasRole,
    }: {
      userId: string;
      role: AppRole;
      hasRole: boolean;
    }) => {
      if (hasRole) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Operator role updated.");
      queryClient.invalidateQueries({ queryKey: ["operators-admin"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-eyebrow">Telecom, BulkSMS Nigeria v2 &amp; Satellite Hub</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Network &amp; Provider Gateways
          </h1>
        </div>

        {/* Clean Responsive Section Switcher Tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {[
            { id: "directory" as const, label: "Smart SMS Directory & Alert Push", icon: Users },
            { id: "bulksms" as const, label: "BulkSMS v2 Diagnostics", icon: MessageSquare },
            { id: "gateways" as const, label: "All Gateways & CAP Probe", icon: Radio },
            { id: "zones" as const, label: "Coverage Zones", icon: MapPin },
            { id: "operators" as const, label: "Operators & Roles", icon: Shield },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeSection === tab.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 0: SMART BULKSMS RECIPIENT DIRECTORY & TELCO-SAFE ALERT CAMPAIGN PUSH */}
      {activeSection === "directory" && <SmartSmsManager />}

      {/* TAB 1: BULKSMS NIGERIA API V2 & SANDBOX V2 */}
      {activeSection === "bulksms" && (
        <div className="space-y-6">
          <section className="command-card rounded-xl border border-border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold sm:text-xl">
                    BulkSMS Nigeria API v2 &amp; Sandbox Integration
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Base URL:{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-foreground">
                    {BULKSMS_NIGERIA_BASE_URLS[bsngEnv]}
                  </code>{" "}
                  · Supports <code className="font-mono">/sms</code>,{" "}
                  <code className="font-mono">/voice/create</code>,{" "}
                  <code className="font-mono">/balance</code>, and <code className="font-mono">BSNG-XXXX</code>{" "}
                  diagnostics.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-border bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setBsngEnv("sandbox")}
                    className={`rounded-md px-3 py-1 font-mono text-xs font-semibold transition-colors ${
                      bsngEnv === "sandbox"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sandbox (Zero Cost)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBsngEnv("production")}
                    className={`rounded-md px-3 py-1 font-mono text-xs font-semibold transition-colors ${
                      bsngEnv === "production"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Production (/api/v2)
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => balanceMutation.mutate()}
                  disabled={balanceMutation.isPending}
                >
                  <Wallet className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  {balanceMutation.isPending ? "Checking…" : "Check Balance"}
                </Button>
              </div>
            </div>

            {bsngBalance && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-xs">
                <span>
                  Code: <strong>{bsngBalance.bsngCode}</strong> (HTTP {bsngBalance.httpStatus}) ·{" "}
                  {bsngBalance.bsngDescription}
                </span>
                {bsngBalance.formatted && (
                  <span className="font-bold text-success">
                    Balance: {bsngBalance.formatted}
                  </span>
                )}
              </div>
            )}

            <form
              className="mt-5 grid gap-4 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                bulkSmsMutation.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="bsng-token">
                  Authorization Bearer Token (or set BULKSMS_NIGERIA_API_TOKEN in .env)
                </Label>
                <Input
                  id="bsng-token"
                  type="password"
                  value={bsngToken}
                  onChange={(e) => setBsngToken(e.target.value)}
                  placeholder="Bearer YOUR_API_TOKEN"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bsng-mode">Endpoint Mode</Label>
                  <select
                    id="bsng-mode"
                    value={bsngMode}
                    onChange={(e) => setBsngMode(e.target.value as "sms" | "voice")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="sms">POST /sms (Bulk SMS)</option>
                    <option value="voice">POST /voice/create (Voice TTS)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bsng-gateway">Gateway Route</Label>
                  <select
                    id="bsng-gateway"
                    value={bsngGateway}
                    onChange={(e) => setBsngGateway(e.target.value as BulkSmsGatewayRoute)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="direct-refund">direct-refund (Default)</option>
                    <option value="corporate">corporate</option>
                    <option value="direct-corporate">direct-corporate</option>
                    <option value="otp">otp</option>
                    <option value="international">international</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bsng-from">Sender ID (`from`, max 11 chars)</Label>
                  <Input
                    id="bsng-from"
                    maxLength={11}
                    value={bsngFrom}
                    onChange={(e) => setBsngFrom(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bsng-ref">Customer Reference</Label>
                  <Input
                    id="bsng-ref"
                    value={bsngCustomerRef}
                    onChange={(e) => setBsngCustomerRef(e.target.value)}
                    placeholder="order-42"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bsng-to">Recipients (`to`, comma-separated international)</Label>
                <Input
                  id="bsng-to"
                  value={bsngTo}
                  onChange={(e) => setBsngTo(e.target.value)}
                  placeholder="2347037770033,2349050030090"
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="bsng-body">Message Body (`body`)</Label>
                <Textarea
                  id="bsng-body"
                  rows={2}
                  value={bsngBody}
                  onChange={(e) => setBsngBody(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bsng-callback">Delivery Webhook Callback URL (optional)</Label>
                <Input
                  id="bsng-callback"
                  value={bsngCallbackUrl}
                  onChange={(e) => setBsngCallbackUrl(e.target.value)}
                  placeholder="https://yourapp.com/webhooks/sms?secret=..."
                />
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2.5 pb-2 text-sm">
                  <Checkbox
                    checked={bsngUnicode}
                    onCheckedChange={(v) => setBsngUnicode(Boolean(v))}
                  />
                  <span>Unicode mode (`unicode: true`, 70 chars/page)</span>
                </label>

                <Button type="submit" disabled={bulkSmsMutation.isPending}>
                  <Play className="mr-1.5 h-4 w-4" />
                  {bulkSmsMutation.isPending
                    ? "Sending to BulkSMS Nigeria…"
                    : `Send ${bsngEnv === "sandbox" ? "Sandbox" : "Production"} ${bsngMode.toUpperCase()}`}
                </Button>
              </div>
            </form>

            {bsngReport && (
              <div className="mt-6 rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        bsngReport.ok
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {bsngReport.bsngCode} · {bsngReport.bsngCategory}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      HTTP {bsngReport.httpStatus} · {bsngReport.latencyMs}ms · Attempts:{" "}
                      {bsngReport.attempts}
                    </span>
                    {bsngReport.sandboxMode && (
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                        sandbox_mode: true
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {bsngReport.endpointUrl}
                  </span>
                </div>
                <p className="mt-2.5 text-xs font-medium text-foreground">
                  {bsngReport.bsngDescription}
                </p>
                <pre className="mt-2.5 max-h-56 overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-xs text-muted-foreground">
                  <code>{bsngReport.rawResponse}</code>
                </pre>
              </div>
            )}
          </section>

          {/* Delivery Webhook Tester & BSNG Error Code Reference */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="command-card rounded-xl border border-border p-5">
              <h3 className="font-display text-base font-bold">
                Delivery Webhook Receiver Verification
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Per BulkSMS Nigeria webhook spec: treats{" "}
                <code className="text-foreground">delivrd</code>,{" "}
                <code className="text-foreground">delivered</code>, and{" "}
                <code className="text-foreground">success</code> as delivered, and any other network
                code (<code className="text-foreground">undeliv</code>,{" "}
                <code className="text-foreground">expired</code>,{" "}
                <code className="text-foreground">rejectd</code>) as failed.
              </p>

              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  dlrWebhookMutation.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="dlr-id">message_id</Label>
                  <Input
                    id="dlr-id"
                    value={dlrMessageId}
                    onChange={(e) => setDlrMessageId(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dlr-recipient">recipient</Label>
                    <Input
                      id="dlr-recipient"
                      value={dlrRecipient}
                      onChange={(e) => setDlrRecipient(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dlr-status">delivery_status</Label>
                    <select
                      id="dlr-status"
                      value={dlrStatus}
                      onChange={(e) => setDlrStatus(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="delivrd">delivrd (→ delivered)</option>
                      <option value="delivered">delivered (→ delivered)</option>
                      <option value="success">success (→ delivered)</option>
                      <option value="undeliv">undeliv (→ failed)</option>
                      <option value="expired">expired (→ failed)</option>
                      <option value="rejectd">rejectd (→ failed)</option>
                    </select>
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={dlrWebhookMutation.isPending}
                >
                  Process Delivery Webhook Update
                </Button>
              </form>
            </section>

            <section className="command-card rounded-xl border border-border p-5">
              <h3 className="font-display text-base font-bold">
                BSNG-XXXX Error Code Matrix
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Built-in error decoder and retry policy (5xxx errors auto-retry with exponential
                backoff; 4xx client errors do not retry).
              </p>
              <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface font-mono text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">HTTP</th>
                      <th className="px-3 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.values(BSNG_ERROR_CODES).map((item) => (
                      <tr key={item.code}>
                        <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-foreground">
                          {item.code}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {item.httpStatus}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: ALL GATEWAYS & CAP 1.2 WEBHOOK PROBE */}
      {activeSection === "gateways" && (
        <div className="space-y-8">
          <section className="command-card rounded-xl border border-border p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold">Live Provider Webhook Probe</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Sends a signed <code className="text-foreground">status: &quot;Test&quot;</code>{" "}
              OASIS CAP 1.2 HTTP POST with{" "}
              <code className="text-foreground">X-SafeAlert-Signature</code> (HMAC-SHA256) to your
              gateway endpoint or the active registered provider gateway.
            </p>

            <form
              className="mt-4 grid gap-4 md:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                const zone = (zonesQuery.data ?? []).find((z) => z.code === testZoneCode);
                const defaultGw = (gatewaysQuery.data ?? []).find(
                  (g) => g.channel === testChannel && g.is_active && g.endpoint,
                );
                probeMutation.mutate({
                  gatewayId: defaultGw?.id ?? null,
                  channel: testChannel,
                  endpointUrl: testEndpoint.trim() || defaultGw?.endpoint || null,
                  zoneCode: testZoneCode,
                  zoneName: zone?.name ?? "Lagos Metropolitan",
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="sandbox-channel">Transport Channel</Label>
                <select
                  id="sandbox-channel"
                  value={testChannel}
                  onChange={(e) => setTestChannel(e.target.value as ChannelKind)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label} ({c.protocol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sandbox-zone">Target Zone</Label>
                <select
                  id="sandbox-zone"
                  value={testZoneCode}
                  onChange={(e) => setTestZoneCode(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {(zonesQuery.data ?? []).map((z) => (
                    <option key={z.id} value={z.code}>
                      {z.code} — {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="sandbox-url">
                  Override Webhook URL (leave blank to probe active channel gateway)
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="sandbox-url"
                    value={testEndpoint}
                    onChange={(e) => setTestEndpoint(e.target.value)}
                    placeholder="https://postman-echo.com/post"
                  />
                  <Button type="submit" disabled={probeMutation.isPending}>
                    <Play className="mr-1.5 h-4 w-4" />
                    {probeMutation.isPending ? "Probing…" : "Send Probe"}
                  </Button>
                </div>
              </div>
            </form>

            {testReport && (
              <div className="mt-5 rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <CheckCircle2
                      className={`h-4 w-4 ${testReport.ok ? "text-success" : "text-destructive"}`}
                    />
                    <span className="font-mono text-xs font-bold uppercase">
                      {channelLabel(testReport.channel)} Probe
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase ${
                        testReport.ok
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {testReport.ok ? "Live HTTP 200 OK" : "HTTP Error"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      HTTP {testReport.statusCode} · {testReport.latencyMs} ms · Ref:{" "}
                      {testReport.gatewayReference}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: "payload", label: "Channel JSON" },
                        { id: "capxml", label: "CAP 1.2 XML" },
                        { id: "headers", label: "HMAC Headers" },
                        { id: "response", label: "Gateway Response" },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setReportTab(t.id)}
                        className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium uppercase ${
                          reportTab === t.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      Endpoint: {testReport.targetEndpoint}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 font-mono text-[11px]"
                      onClick={() => {
                        const text =
                          reportTab === "capxml"
                            ? testReport.capXml
                            : reportTab === "headers"
                              ? JSON.stringify(testReport.requestHeaders, null, 2)
                              : reportTab === "response"
                                ? testReport.responsePreview
                                : testReport.requestPayload;
                        navigator.clipboard.writeText(text);
                        toast.success("Copied to clipboard.");
                      }}
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy
                    </Button>
                  </div>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-card p-3.5 font-mono text-xs leading-relaxed text-muted-foreground">
                    <code>
                      {reportTab === "capxml"
                        ? testReport.capXml
                        : reportTab === "headers"
                          ? JSON.stringify(testReport.requestHeaders, null, 2)
                          : reportTab === "response"
                            ? testReport.responsePreview
                            : testReport.requestPayload}
                    </code>
                  </pre>
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-3">
              <h2 className="font-display text-lg font-bold">Registered Channel Gateways</h2>
              {(gatewaysQuery.data ?? []).map((gw) => (
                <div
                  key={gw.id}
                  className="command-card flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{gw.name}</span>
                      <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {channelLabel(gw.channel)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${
                          gw.health === "healthy"
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning"
                        }`}
                      >
                        {gw.health}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {gw.operator_name ?? "Operator"} · {gw.protocol} · {gw.region}
                    </p>
                    {gw.endpoint && (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {gw.endpoint}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={probeMutation.isPending}
                      onClick={() =>
                        probeMutation.mutate({
                          gatewayId: gw.id,
                          channel: gw.channel,
                          endpointUrl: gw.endpoint,
                          zoneCode: testZoneCode,
                        })
                      }
                    >
                      <Code2 className="mr-1.5 h-3.5 w-3.5 text-primary" /> Test Live
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            toggleGatewayMutation.mutate({
                              id: gw.id,
                              is_active: gw.is_active,
                              health: gw.health === "healthy" ? "degraded" : "healthy",
                            })
                          }
                        >
                          <Activity className="mr-1.5 h-3.5 w-3.5" />
                          {gw.health === "healthy" ? "Degrade" : "Restore"}
                        </Button>
                        <Button
                          size="sm"
                          variant={gw.is_active ? "secondary" : "default"}
                          onClick={() =>
                            toggleGatewayMutation.mutate({
                              id: gw.id,
                              is_active: !gw.is_active,
                              health: gw.health,
                            })
                          }
                        >
                          {gw.is_active ? "Disable" : "Enable"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isAdmin && (
              <form
                className="command-card space-y-4 self-start rounded-xl border border-border p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  addGatewayMutation.mutate();
                }}
              >
                <h3 className="font-display text-base font-bold">Register Provider Gateway</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="gw-channel">Channel Transport</Label>
                  <select
                    id="gw-channel"
                    value={gwChannel}
                    onChange={(e) => {
                      const val = e.target.value as ChannelKind;
                      setGwChannel(val);
                      const preset = CHANNELS.find((c) => c.value === val);
                      if (preset) setGwProtocol(preset.protocol);
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {CHANNELS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label} ({c.transport})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gw-name">Gateway Name</Label>
                  <Input
                    id="gw-name"
                    value={gwName}
                    onChange={(e) => setGwName(e.target.value)}
                    placeholder="BulkSMS Nigeria Direct Route"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="gw-operator">Operator / Partner</Label>
                    <Input
                      id="gw-operator"
                      value={gwOperator}
                      onChange={(e) => setGwOperator(e.target.value)}
                      placeholder="BulkSMS Nigeria"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gw-region">Region</Label>
                    <Input
                      id="gw-region"
                      value={gwRegion}
                      onChange={(e) => setGwRegion(e.target.value)}
                      placeholder="National"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gw-protocol">Protocol</Label>
                  <Input
                    id="gw-protocol"
                    value={gwProtocol}
                    onChange={(e) => setGwProtocol(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gw-endpoint">HTTPS Webhook Endpoint URL</Label>
                  <Input
                    id="gw-endpoint"
                    type="url"
                    value={gwEndpoint}
                    onChange={(e) => setGwEndpoint(e.target.value)}
                    placeholder="https://www.bulksmsnigeria.com/api/sandbox/v2/sms"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={addGatewayMutation.isPending}>
                  <Plus className="mr-1.5 h-4 w-4" /> Register Gateway
                </Button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: COVERAGE ZONES */}
      {activeSection === "zones" && (
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold">Geographical Coverage Zones</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(zonesQuery.data ?? []).map((zone) => (
                <div
                  key={zone.id}
                  className="command-card flex items-start justify-between rounded-xl border border-border p-4"
                >
                  <div>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                      {zone.code}
                    </span>
                    <h3 className="mt-2 font-semibold">{zone.name}</h3>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Pop: {formatCount(Number(zone.population_estimate ?? 0))}
                      {zone.region ? ` · ${zone.region}` : ""}
                    </p>
                    {zone.centre_lat != null && zone.centre_lng != null && (
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {zone.centre_lat.toFixed(4)}, {zone.centre_lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteZoneMutation.mutate(zone.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <form
              className="command-card space-y-4 self-start rounded-xl border border-border p-5"
              onSubmit={(e) => {
                e.preventDefault();
                addZoneMutation.mutate();
              }}
            >
              <h3 className="font-display text-base font-bold">Add Coverage Zone</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="zone-code">Zone Code</Label>
                  <Input
                    id="zone-code"
                    value={zoneCode}
                    onChange={(e) => setZoneCode(e.target.value)}
                    placeholder="KAD-CENTRAL"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zone-region">State / Region</Label>
                  <Input
                    id="zone-region"
                    value={zoneRegion}
                    onChange={(e) => setZoneRegion(e.target.value)}
                    placeholder="Kaduna"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-name">Zone Name</Label>
                <Input
                  id="zone-name"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Kaduna Central Corridor"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-pop">Population Estimate</Label>
                <Input
                  id="zone-pop"
                  type="number"
                  min={0}
                  value={zonePop}
                  onChange={(e) => setZonePop(e.target.value)}
                  placeholder="2100000"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="zone-lat">Centre Latitude</Label>
                  <Input
                    id="zone-lat"
                    type="number"
                    step="any"
                    value={zoneLat}
                    onChange={(e) => setZoneLat(e.target.value)}
                    placeholder="10.5105"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zone-lng">Centre Longitude</Label>
                  <Input
                    id="zone-lng"
                    type="number"
                    step="any"
                    value={zoneLng}
                    onChange={(e) => setZoneLng(e.target.value)}
                    placeholder="7.4165"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={addZoneMutation.isPending}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Coverage Zone
              </Button>
            </form>
          )}
        </section>
      )}

      {/* TAB 4: OPERATORS & ROLES */}
      {activeSection === "operators" && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Operator Directory &amp; Role Control</h2>
          {(operatorsQuery.data ?? []).map((op) => (
            <div
              key={op.id}
              className="command-card flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
            >
              <div>
                <p className="font-semibold">{op.full_name || "Operator"}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {op.agency || "National Command"} · ID: {op.id.slice(0, 8)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["admin", "operator", "viewer"] as AppRole[]).map((role) => {
                  const active = op.roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      disabled={!isAdmin || toggleRoleMutation.isPending}
                      onClick={() =>
                        toggleRoleMutation.mutate({
                          userId: op.id,
                          role,
                          hasRole: active,
                        })
                      }
                      className={`rounded-full border px-3 py-1 font-mono text-xs font-medium uppercase tracking-wider transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {active ? `✓ ${role}` : `+ ${role}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
