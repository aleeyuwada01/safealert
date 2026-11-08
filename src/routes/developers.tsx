import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  KeyRound,
  Terminal,
  BookOpen,
  Webhook,
  Copy,
  Check,
  Plus,
  Trash2,
  Play,
  Eye,
  EyeOff,
  ShieldCheck,
  Activity,
  LogIn,
  LogOut,
  RefreshCw,
  Globe,
  Lock,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  getDeveloperWorkspace,
  createDeveloperApiKey,
  toggleDeveloperApiKey,
  deleteDeveloperApiKey,
  createDeveloperWebhook,
  deleteDeveloperWebhook,
  triggerDeveloperWebhookTest,
  runDeveloperApiPlayground,
} from "@/lib/developer-api.functions";
import type { DeveloperApiKeyRow, DeveloperWebhookRow } from "@/lib/developer-api.server";
import { toast } from "sonner";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developer Portal & REST API v1 Documentation — SafeAlert (safealert.live)" },
      {
        name: "description",
        content:
          "Production REST API v1 documentation, API key provisioning (sa_live_... & sa_test_...), interactive endpoint playground, and HMAC-SHA256 webhook integration for SafeAlert.",
      },
    ],
  }),
  loader: async () => {
    try {
      return await getDeveloperWorkspace();
    } catch {
      return { apiKeys: [], webhooks: [], zones: [] };
    }
  },
  component: DevelopersPortalPage,
});

const SA_STATUS_CODES = [
  {
    code: "SA-0000",
    http: "200 OK",
    meaning: "Request Succeeded",
    action: "Payload returned in data field; rate-limit headers updated.",
  },
  {
    code: "SA-4000",
    http: "400 Bad Request",
    meaning: "Invalid Query Parameter",
    action: "Verify zone code (LAG-METRO, FCT-ABJ, KAN-NORTH, RIV-DELTA) or severity filter.",
  },
  {
    code: "SA-4001",
    http: "401 Unauthorized",
    meaning: "Missing API Token",
    action: "Pass Authorization: Bearer sa_live_... or X-API-Key header.",
  },
  {
    code: "SA-4003",
    http: "403 Forbidden",
    meaning: "Invalid, Paused, or Revoked Key",
    action: "Check that your API key is active in the Developer Portal and has required scopes.",
  },
  {
    code: "SA-4004",
    http: "404 Not Found",
    meaning: "Unknown Endpoint Path",
    action: "Use /api/v1/alerts, /api/v1/intelligence, /api/v1/zones, or /api/v1/status.",
  },
  {
    code: "SA-4029",
    http: "429 Too Many Requests",
    meaning: "Rate Quota Exceeded",
    action: "Respect X-RateLimit-Remaining header (600 req/min Live, 120 req/min Sandbox).",
  },
  {
    code: "SA-5000",
    http: "500 Server Error",
    meaning: "Upstream Telemetry Timeout",
    action: "Retry with exponential backoff (1s, 2s, 4s).",
  },
];

function DevelopersPortalPage() {
  const initialData = Route.useLoaderData();
  const [apiKeys, setApiKeys] = useState<DeveloperApiKeyRow[]>(initialData.apiKeys ?? []);
  const [webhooks, setWebhooks] = useState<DeveloperWebhookRow[]>(initialData.webhooks ?? []);
  const [activeTab, setActiveTab] = useState<"docs" | "keys" | "playground" | "webhooks">("docs");

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [signingInDemo, setSigningInDemo] = useState(false);

  // API Key creation state
  const [keyName, setKeyName] = useState("");
  const [keyOrg, setKeyOrg] = useState("");
  const [keyEnv, setKeyEnv] = useState<"live" | "test">("live");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Playground state
  const [selectedApiKey, setSelectedApiKey] = useState<string>(
    initialData.apiKeys?.[0]?.api_key ?? "sa_live_acme_8f92a1b4c7d0e3f6a9b2c5d8e1f4a7b0",
  );
  const [endpoint, setEndpoint] = useState<
    "/api/v1/alerts" | "/api/v1/intelligence" | "/api/v1/zones" | "/api/v1/status"
  >("/api/v1/alerts");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [runningPlayground, setRunningPlayground] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<Awaited<
    ReturnType<typeof runDeveloperApiPlayground>
  > | null>(null);

  // Webhook state
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("https://postman-echo.com/post");
  const [whZones, setWhZones] = useState<string[]>(["LAG-METRO", "FCT-ABJ"]);
  const [creatingWh, setCreatingWh] = useState(false);
  const [testingWhId, setTestingWhId] = useState<string | null>(null);
  const [whTestResult, setWhTestResult] = useState<Awaited<
    ReturnType<typeof triggerDeveloperWebhookTest>
  > | null>(null);

  // Code snippet tabs
  const [codeLang, setCodeLang] = useState<"curl" | "javascript" | "python" | "php">("curl");
  const [whVerifyLang, setWhVerifyLang] = useState<"node" | "python" | "php">("node");

  useEffect(() => {
    const normalizeEmail = (raw: string | null | undefined) =>
      raw ? raw.replace(/@safealert\.gov$/i, "@safealert.live") : null;

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user?.email === "operator@safealert.gov") {
        const { data: refreshed } = await supabase.auth.signInWithPassword({
          email: "operator@safealert.live",
          password: "SafeAlert2026!",
        });
        setUserEmail(normalizeEmail(refreshed.session?.user?.email ?? "operator@safealert.live"));
        setUserId(refreshed.session?.user?.id ?? null);
        return;
      }
      setUserEmail(normalizeEmail(data.session?.user?.email));
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(normalizeEmail(session?.user?.email));
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function refreshWorkspace() {
    try {
      const fresh = await getDeveloperWorkspace();
      setApiKeys(fresh.apiKeys);
      setWebhooks(fresh.webhooks);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh workspace");
    }
  }

  async function handleDemoDeveloperSignIn() {
    setSigningInDemo(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: "dev@acme.ng",
      password: "SafeAlertDev2026!",
    });
    setSigningInDemo(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in as Tunde Bakare (dev@acme.ng — Acme Logistics Nigeria Ltd)");
    await refreshWorkspace();
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim() || !keyOrg.trim()) return;
    setCreatingKey(true);
    try {
      const created = await createDeveloperApiKey({
        data: {
          userId,
          name: keyName.trim(),
          organization: keyOrg.trim(),
          environment: keyEnv,
          scopes: ["alerts:read", "intelligence:read", "zones:read", "webhooks:manage"],
          rateLimitPerMin: keyEnv === "live" ? 600 : 120,
        },
      });
      setNewlyCreatedKey(created.api_key);
      setSelectedApiKey(created.api_key);
      setKeyName("");
      setKeyOrg("");
      toast.success(`Created ${created.environment.toUpperCase()} API key: ${created.key_prefix}`);
      await refreshWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleToggleKey(row: DeveloperApiKeyRow) {
    try {
      await toggleDeveloperApiKey({ data: { id: row.id, is_active: !row.is_active } });
      toast.success(row.is_active ? "API key paused" : "API key re-activated");
      await refreshWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDeleteKey(id: string) {
    try {
      await deleteDeveloperApiKey({ data: { id } });
      toast.success("API key revoked and deleted");
      await refreshWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleRunPlayground() {
    setRunningPlayground(true);
    try {
      const res = await runDeveloperApiPlayground({
        data: {
          apiKey: selectedApiKey,
          endpoint,
          zoneFilter,
          severityFilter,
        },
      });
      setPlaygroundResult(res);
      toast.success(`${endpoint} responded with HTTP ${res.httpStatus} in ${res.latencyMs}ms`);
      await refreshWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "API request failed");
    } finally {
      setRunningPlayground(false);
    }
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!whName.trim() || !whUrl.trim()) return;
    setCreatingWh(true);
    try {
      await createDeveloperWebhook({
        data: {
          userId,
          name: whName.trim(),
          targetUrl: whUrl.trim(),
          events: ["alert.live", "alert.extreme", "intelligence.epidemic"],
          zoneCodes: whZones.length > 0 ? whZones : ["ALL"],
        },
      });
      setWhName("");
      toast.success("Business webhook endpoint registered");
      await refreshWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Webhook creation failed");
    } finally {
      setCreatingWh(false);
    }
  }

  async function handleTestWebhook(id: string) {
    setTestingWhId(id);
    try {
      const res = await triggerDeveloperWebhookTest({ data: { webhookId: id } });
      setWhTestResult(res);
      if (res.ok) {
        toast.success(`Signed webhook delivered (HTTP ${res.statusCode} · ${res.latencyMs}ms)`);
      } else {
        toast.error(`Webhook target returned HTTP ${res.statusCode}`);
      }
      await refreshWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Webhook test failed");
    } finally {
      setTestingWhId(null);
    }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  const canonicalBaseUrl = "https://safealert.live";
  const queryUrl = `${canonicalBaseUrl}${endpoint}${
    zoneFilter !== "ALL" ? `?zone=${zoneFilter}` : ""
  }`;

  const codeSnippets = {
    curl: `curl -X GET "${queryUrl}" \\
  -H "Authorization: Bearer ${selectedApiKey}" \\
  -H "Accept: application/json"`,
    javascript: `// Node.js 20+ / Browser Fetch
const response = await fetch("${queryUrl}", {
  method: "GET",
  headers: {
    "Authorization": "Bearer ${selectedApiKey}",
    "Accept": "application/json",
  },
});

if (!response.ok) {
  throw new Error(\`SafeAlert API error: \${response.status}\`);
}

const payload = await response.json();
console.log("SafeAlert Code:", payload.code); // "SA-0000"
console.log("Active Broadcasts:", payload.data);`,
    python: `import requests

response = requests.get(
    "${queryUrl}",
    headers={
        "Authorization": "Bearer ${selectedApiKey}",
        "Accept": "application/json",
    },
    timeout=10,
)
response.raise_for_status()
payload = response.json()
print(f"Status: {payload['code']} | Count: {payload.get('count', 0)}")
for alert in payload.get("data", []):
    print(f"[{alert['severity'].upper()}] {alert['headline']}")`,
    php: `<?php
$ch = curl_init("${queryUrl}");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer ${selectedApiKey}",
        "Accept: application/json",
    ],
]);

$raw = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$payload = json_decode($raw, true);
if ($httpCode === 200 && ($payload['code'] ?? '') === 'SA-0000') {
    foreach ($payload['data'] as $alert) {
        echo "[" . strtoupper($alert['severity']) . "] " . $alert['headline'] . PHP_EOL;
    }
}`,
  };

  const webhookVerifySnippets = {
    node: `import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySafeAlertWebhook(
  rawBody: string,
  timestampHeader: string,
  signatureHeader: string,
  webhookSecret: string, // e.g. "whsec_sa_99f1c8d2..."
): boolean {
  const expected =
    "sha256=" +
    createHmac("sha256", webhookSecret)
      .update(\`\${timestampHeader}.\${rawBody}\`)
      .digest("hex");

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}`,
    python: `import hmac
import hashlib

def verify_safealert_webhook(
    raw_body: str,
    timestamp_header: str,
    signature_header: str,
    webhook_secret: str,
) -> bool:
    signed_payload = f"{timestamp_header}.{raw_body}".encode("utf-8")
    expected_hex = hmac.new(
        webhook_secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    expected = f"sha256={expected_hex}"
    return hmac.compare_digest(expected, signature_header)`,
    php: `<?php
// Verify X-SafeAlert-Signature on incoming POST https://yourcompany.com/webhooks/safealert
$rawBody   = file_get_contents('php://input');
$timestamp = $_SERVER['HTTP_X_SAFEALERT_TIMESTAMP'] ?? '';
$signature = $_SERVER['HTTP_X_SAFEALERT_SIGNATURE'] ?? '';
$secret    = 'whsec_sa_99f1c8d2e4b7a0f3c6d9e2a5b8c1f4d7';

$expected  = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $rawBody, $secret);
if (!hash_equals($expected, $signature)) {
    http_response_code(403);
    exit('Invalid signature');
}

$event = json_decode($rawBody, true);
http_response_code(200);
echo json_encode(['received' => true]);`,
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Top Hero Banner */}
        <div className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              <Globe className="h-3.5 w-3.5" />
              SafeAlert Public REST API v1 · https://safealert.live/api/v1
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
              Developer Documentation &amp; API Key Portal
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Integrate real-time OASIS CAP 1.2 emergency broadcasts, autonomous WHO/NCDC epidemic
              surveillance, and Open-Meteo hazard telemetry into hospital systems, logistics fleets,
              fintech apps, and enterprise security dashboards.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end shrink-0">
            {userEmail ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2 text-xs">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-success">
                    Authenticated Session
                  </span>
                  <span className="font-semibold text-foreground">{userEmail}</span>
                </div>
                {userEmail !== "dev@acme.ng" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDemoDeveloperSignIn}
                    disabled={signingInDemo}
                    className="h-9 rounded-xl text-xs"
                  >
                    <LogIn className="mr-1.5 h-3.5 w-3.5 text-primary" />
                    Switch to Demo Dev (dev@acme.ng)
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUserId(null);
                    setUserEmail(null);
                    toast.success("Signed out of Developer Portal");
                    await refreshWorkspace();
                  }}
                  className="h-9 rounded-xl border-destructive/30 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  Log Out
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleDemoDeveloperSignIn}
                  disabled={signingInDemo}
                  className="rounded-xl"
                >
                  <LogIn className="mr-1.5 h-3.5 w-3.5" />
                  {signingInDemo ? "Signing in…" : "1-Click Demo Developer Login (dev@acme.ng)"}
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-xl">
                  <Link to="/auth" search={{ portal: "developer" } as never}>
                    Partner Sign In / Register
                  </Link>
                </Button>
              </div>
            )}
            <span className="font-mono text-[11px] text-muted-foreground">
              Production Base URL:{" "}
              <code className="font-semibold text-foreground">https://safealert.live/api/v1</code>
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("docs")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === "docs"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            1. Production API Documentation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === "keys"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            2. API Keys &amp; Provisioning ({apiKeys.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("playground")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === "playground"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            3. Live API Playground
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("webhooks")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === "webhooks"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Webhook className="h-3.5 w-3.5" />
            4. Business Webhooks ({webhooks.length})
          </button>
        </div>

        {/* TAB 1: PRODUCTION API DOCUMENTATION */}
        {activeTab === "docs" && (
          <div className="mt-6 space-y-8">
            {/* Base URLs & Environments */}
            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="text-eyebrow">🌐 Base URL &amp; Environments</p>
                  <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">
                    Production &amp; Sandbox API Architecture
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The SafeAlert REST API uses a single canonical base URL over TLS 1.3. Your
                    environment (<strong className="text-foreground">Production</strong> vs{" "}
                    <strong className="text-foreground">Sandbox</strong>) is determined
                    automatically by the prefix of the API key you authenticate with.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-border bg-surface p-3.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                        Production Environment (600 req/min)
                      </span>
                      <p className="mt-1 font-mono text-xs font-bold text-foreground select-all">
                        https://safealert.live/api/v1
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Authenticate with a <code className="text-foreground">sa_live_...</code>{" "}
                        key for production hospital, logistics, and enterprise deployments.
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface p-3.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                        Sandbox / Testing Environment (120 req/min · Zero Quota Cost)
                      </span>
                      <p className="mt-1 font-mono text-xs font-bold text-foreground select-all">
                        https://safealert.live/api/v1
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Authenticate with a <code className="text-foreground">sa_test_...</code>{" "}
                        key during development and CI/CD integration testing.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Authentication Methods */}
                <div>
                  <p className="text-eyebrow">🔐 Authentication</p>
                  <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">
                    Flexible Token Authentication
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    SafeAlert accepts your API key in three ways for compatibility across backend
                    SDKs, webhook bridges, and no-code automation tools:
                  </p>

                  <div className="mt-4 space-y-2.5 font-mono text-xs">
                    <div className="rounded-xl border border-primary/30 bg-primary/6 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-primary">
                          1. Authorization Header (Recommended)
                        </span>
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                          RFC 6750
                        </span>
                      </div>
                      <code className="mt-1 block text-foreground select-all">
                        Authorization: Bearer {selectedApiKey}
                      </code>
                    </div>

                    <div className="rounded-xl border border-border bg-surface p-3">
                      <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                        2. Custom API Key Header
                      </span>
                      <code className="mt-1 block text-foreground select-all">
                        X-API-Key: {selectedApiKey}
                      </code>
                    </div>

                    <div className="rounded-xl border border-border bg-surface p-3">
                      <span className="block text-[10px] font-bold uppercase text-muted-foreground">
                        3. URL Query Parameter
                      </span>
                      <code className="mt-1 block truncate text-foreground select-all">
                        https://safealert.live/api/v1/alerts?api_key={selectedApiKey}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Available Endpoints Summary Table */}
            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-eyebrow">Endpoint Catalogue</p>
                  <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">
                    REST API v1 Endpoints
                  </h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setActiveTab("playground")}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Test Endpoints Live in Playground
                </Button>
              </div>

              <div className="mt-5 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-surface font-mono uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Endpoint</th>
                      <th className="px-4 py-3">Required Scope</th>
                      <th className="px-4 py-3">Query Parameters</th>
                      <th className="px-4 py-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    <tr>
                      <td className="px-4 py-3">
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-500">
                          GET
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">/api/v1/alerts</td>
                      <td className="px-4 py-3 text-primary">alerts:read</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        ?zone=LAG-METRO &amp;severity=extreme
                      </td>
                      <td className="px-4 py-3 font-sans text-muted-foreground">
                        List active national emergency broadcasts with CAP 1.2 URN identifiers and
                        targeted coverage zones.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-500">
                          GET
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">/api/v1/intelligence</td>
                      <td className="px-4 py-3 text-primary">intelligence:read</td>
                      <td className="px-4 py-3 text-muted-foreground">?zone=FCT-ABJ</td>
                      <td className="px-4 py-3 font-sans text-muted-foreground">
                        Retrieve live autonomous WHO Disease Outbreak News (Ebola), NCDC SitReps
                        (Lassa/Cholera), and Open-Meteo zone telemetry.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-500">
                          GET
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">/api/v1/zones</td>
                      <td className="px-4 py-3 text-primary">zones:read</td>
                      <td className="px-4 py-3 text-muted-foreground">—</td>
                      <td className="px-4 py-3 font-sans text-muted-foreground">
                        List all national coverage zone codes, geographic centroids, and population
                        estimates.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-500">
                          GET
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">/api/v1/status</td>
                      <td className="px-4 py-3 text-primary">any</td>
                      <td className="px-4 py-3 text-muted-foreground">—</td>
                      <td className="px-4 py-3 font-sans text-muted-foreground">
                        Verify API key validity, inspect organization rate quotas, and check
                        national grid status.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Detailed Endpoint 1: GET /api/v1/alerts */}
            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-emerald-500/15 px-3 py-1 font-mono text-xs font-extrabold text-emerald-500">
                    GET
                  </span>
                  <h3 className="font-mono text-base font-bold sm:text-lg">
                    https://safealert.live/api/v1/alerts
                  </h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  Scope: <strong className="text-foreground">alerts:read</strong>
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                Returns all currently active (<code className="text-foreground">live</code> and{" "}
                <code className="text-foreground">broadcasting</code>) national emergency alerts,
                including multi-language instructions, siren status, coverage zone coordinates, and
                canonical OASIS CAP 1.2 URN identifiers.
              </p>

              {/* Parameters Table */}
              <div>
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Query Parameters
                </h4>
                <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[540px] text-left text-xs">
                    <thead className="bg-surface font-mono uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">Parameter</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Required</th>
                        <th className="px-4 py-2.5">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-foreground">zone</td>
                        <td className="px-4 py-2.5 text-muted-foreground">string</td>
                        <td className="px-4 py-2.5 text-muted-foreground">Optional</td>
                        <td className="px-4 py-2.5 font-sans text-muted-foreground">
                          Filter alerts targeting a specific zone code (e.g.{" "}
                          <code>LAG-METRO</code>, <code>FCT-ABJ</code>, <code>KAN-NORTH</code>,{" "}
                          <code>RIV-DELTA</code>).
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-foreground">severity</td>
                        <td className="px-4 py-2.5 text-muted-foreground">string</td>
                        <td className="px-4 py-2.5 text-muted-foreground">Optional</td>
                        <td className="px-4 py-2.5 font-sans text-muted-foreground">
                          Filter by severity level: <code>extreme</code>, <code>warning</code>,{" "}
                          <code>watch</code>, or <code>advisory</code>.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Multi-Language Code Examples & Response */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {(["curl", "javascript", "python", "php"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setCodeLang(lang)}
                          className={`rounded-lg px-2.5 py-1 font-mono text-[11px] uppercase ${
                            codeLang === lang
                              ? "bg-primary text-primary-foreground font-bold"
                              : "bg-surface text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => copyText(codeSnippets[codeLang], "doc-snippet")}
                    >
                      {copiedId === "doc-snippet" ? (
                        <Check className="mr-1 h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      Copy
                    </Button>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
                    <code>{codeSnippets[codeLang]}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between py-1">
                    <span className="font-mono text-xs font-bold uppercase text-emerald-500">
                      200 OK · Success Response (SA-0000)
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      application/json
                    </span>
                  </div>
                  <pre className="mt-2 max-h-[300px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
                    <code>{`{
  "status": "success",
  "code": "SA-0000",
  "environment": "live",
  "count": 1,
  "data": [
    {
      "id": "eb01a622-2026-4000-8000-000000000622",
      "hazard": "epidemic",
      "severity": "extreme",
      "status": "live",
      "headline": "EBOLA VIRUS SURVEILLANCE ALERT: Bundibugyo Ebola Disease Reported (WHO DON-622)",
      "instructions": "Avoid contact with blood or body fluids. Report sudden fever to NCDC Toll-Free 6232.",
      "languages": ["en", "ha", "yo", "ig", "pcm"],
      "siren_enabled": true,
      "zones": [
        { "code": "LAG-METRO", "name": "Lagos Metropolitan", "region": "Lagos" },
        { "code": "FCT-ABJ", "name": "Abuja Federal Capital", "region": "FCT" }
      ],
      "cap_1_2_identifier": "urn:oasis:names:tc:emergency:cap:1.2:safealert:eb01a622-2026-4000-8000-000000000622"
    }
  ]
}`}</code>
                  </pre>
                </div>
              </div>
            </section>

            {/* Outbound Business Webhooks Specification */}
            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <p className="text-eyebrow">Real-Time Push Delivery</p>
                  <h3 className="mt-1 font-display text-xl font-extrabold">
                    Outbound Business Webhooks &amp; HMAC-SHA256 Verification
                  </h3>
                </div>
                <span className="rounded-full bg-primary/15 px-3 py-1 font-mono text-xs font-bold text-primary">
                  X-SafeAlert-Signature
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                Instead of polling <code className="text-foreground">/api/v1/alerts</code>, register
                an HTTPS webhook endpoint in the{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("webhooks")}
                  className="font-semibold text-primary underline"
                >
                  Business Webhooks tab
                </button>
                . Whenever SafeAlert issues or updates an alert in your subscribed zones, we send a
                signed <code className="text-foreground">POST</code> request to your server within 2
                seconds.
              </p>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Example Webhook Payload Sent to Your Server
                  </h4>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
                    <code>{`POST https://yourcompany.com/webhooks/safealert
Content-Type: application/json
X-SafeAlert-Event: alert.live
X-SafeAlert-Timestamp: 2026-11-08T14:00:00.000Z
X-SafeAlert-Signature: sha256=7f9c2ba4e8d1a0b3...

{
  "event": "alert.live",
  "webhook_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "delivered_at": "2026-11-08T14:00:00.000Z",
  "authority": "NEMA-NG-SAFEALERT",
  "data": {
    "alert_id": "eb01a622-2026-4000-8000-000000000622",
    "hazard": "epidemic",
    "severity": "extreme",
    "status": "live",
    "headline": "WHO & NCDC Ebola Virus Surveillance Alert — Nigeria",
    "zones": ["LAG-METRO", "FCT-ABJ"],
    "instructions": "Report sudden high fever to NCDC Toll-Free 6232 immediately."
  }
}`}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Verify Signature ({whVerifyLang.toUpperCase()})
                    </span>
                    <div className="flex gap-1">
                      {(["node", "python", "php"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setWhVerifyLang(lang)}
                          className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
                            whVerifyLang === lang
                              ? "bg-primary text-primary-foreground font-bold"
                              : "bg-surface text-muted-foreground"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
                    <code>{webhookVerifySnippets[whVerifyLang]}</code>
                  </pre>
                </div>
              </div>
            </section>

            {/* Status & Error Codes Reference Table */}
            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
              <p className="text-eyebrow">Error Handling &amp; Retries</p>
              <h3 className="mt-1 font-display text-xl font-extrabold">
                SafeAlert API Status Codes (SA-XXXX)
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Every response includes a machine-readable <code className="text-foreground">code</code>{" "}
                field alongside standard HTTP status codes.
              </p>

              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-surface font-mono uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">SA Code</th>
                      <th className="px-4 py-3">HTTP Status</th>
                      <th className="px-4 py-3">Meaning</th>
                      <th className="px-4 py-3">Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {SA_STATUS_CODES.map((row) => (
                      <tr key={row.code}>
                        <td className="px-4 py-3 font-bold text-primary">{row.code}</td>
                        <td className="px-4 py-3 text-foreground">{row.http}</td>
                        <td className="px-4 py-3 font-sans font-semibold text-foreground">
                          {row.meaning}
                        </td>
                        <td className="px-4 py-3 font-sans text-muted-foreground">{row.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: API KEYS */}
        {activeTab === "keys" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <form
                onSubmit={handleCreateKey}
                className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4"
              >
                <div>
                  <p className="text-eyebrow">Provision Credentials</p>
                  <h2 className="mt-1 font-display text-lg font-bold">
                    Create New Developer API Key
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generate a scoped API token to authenticate requests to{" "}
                    <code>https://safealert.live/api/v1/*</code>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Application / Key Name</Label>
                  <Input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g. Zenith Bank Branch Safety Feed"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Business / Organization</Label>
                  <Input
                    value={keyOrg}
                    onChange={(e) => setKeyOrg(e.target.value)}
                    placeholder="e.g. Zenith Bank PLC"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Environment &amp; Rate Tier</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKeyEnv("live")}
                      className={`rounded-xl border p-3 text-left text-xs transition-all ${
                        keyEnv === "live"
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border bg-surface text-muted-foreground"
                      }`}
                    >
                      <span className="block font-mono text-[11px] text-primary">sa_live_...</span>
                      Production (600 req/min)
                    </button>
                    <button
                      type="button"
                      onClick={() => setKeyEnv("test")}
                      className={`rounded-xl border p-3 text-left text-xs transition-all ${
                        keyEnv === "test"
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border bg-surface text-muted-foreground"
                      }`}
                    >
                      <span className="block font-mono text-[11px] text-accent">sa_test_...</span>
                      Sandbox (120 req/min)
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full rounded-xl" disabled={creatingKey}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {creatingKey ? "Generating Key…" : "Generate API Key"}
                </Button>

                {newlyCreatedKey && (
                  <div className="rounded-xl border border-success/40 bg-success/10 p-3.5 text-xs">
                    <p className="font-semibold text-success">New API Key Generated!</p>
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-[11px]">
                      <span className="truncate select-all">{newlyCreatedKey}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => copyText(newlyCreatedKey, "new")}
                      >
                        {copiedId === "new" ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold">Active Partner API Keys</h2>
                  <p className="text-xs text-muted-foreground">
                    Click any key to copy or test it live in the API Playground.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={refreshWorkspace}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>

              <div className="space-y-3">
                {apiKeys.map((k) => {
                  const isRevealed = Boolean(revealedKeys[k.id]);
                  return (
                    <div
                      key={k.id}
                      className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                k.environment === "live"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-accent/15 text-accent"
                              }`}
                            >
                              {k.environment}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                                k.is_active
                                  ? "bg-success/15 text-success"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {k.is_active ? "Active" : "Paused"}
                            </span>
                            <h3 className="font-display text-sm font-bold text-foreground">
                              {k.name}
                            </h3>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Organization: <strong className="text-foreground">{k.organization}</strong>{" "}
                            · Rate Limit: {k.rate_limit_per_min} req/min · Total Calls:{" "}
                            <strong className="text-foreground">{k.requests_count}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => {
                              setSelectedApiKey(k.api_key);
                              setActiveTab("playground");
                            }}
                          >
                            <Play className="mr-1 h-3 w-3 text-primary" />
                            Test Key
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleToggleKey(k)}
                          >
                            {k.is_active ? "Pause" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive"
                            onClick={() => handleDeleteKey(k.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs">
                        <span className="truncate select-all text-foreground">
                          {isRevealed ? k.api_key : `${k.api_key.slice(0, 18)}••••••••••••••••`}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedKeys((prev) => ({ ...prev, [k.id]: !isRevealed }))
                            }
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            title={isRevealed ? "Hide key" : "Reveal full key"}
                          >
                            {isRevealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyText(k.api_key, k.id)}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            title="Copy API key"
                          >
                            {copiedId === k.id ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE API PLAYGROUND */}
        {activeTab === "playground" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
              <div>
                <p className="text-eyebrow">Interactive Explorer</p>
                <h2 className="mt-1 font-display text-lg font-bold">
                  Execute Live REST API v1 Call
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Test your SafeAlert API key against live national alerts, WHO/NCDC surveillance,
                  and zone endpoints.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Bearer API Key</Label>
                <select
                  value={selectedApiKey}
                  onChange={(e) => setSelectedApiKey(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                >
                  {apiKeys.map((k) => (
                    <option key={k.id} value={k.api_key}>
                      {k.name} ({k.key_prefix})
                    </option>
                  ))}
                </select>
                <Input
                  value={selectedApiKey}
                  onChange={(e) => setSelectedApiKey(e.target.value)}
                  className="mt-1.5 font-mono text-xs"
                  placeholder="sa_live_..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Endpoint</Label>
                <select
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value as typeof endpoint)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                >
                  <option value="/api/v1/alerts">GET /api/v1/alerts (Live CAP 1.2 Broadcasts)</option>
                  <option value="/api/v1/intelligence">
                    GET /api/v1/intelligence (Autonomous WHO/NCDC/Weather Feed)
                  </option>
                  <option value="/api/v1/zones">GET /api/v1/zones (National Coverage Zones)</option>
                  <option value="/api/v1/status">
                    GET /api/v1/status (Verify API Key &amp; Quotas)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Zone Filter (?zone=)</Label>
                  <select
                    value={zoneFilter}
                    onChange={(e) => setZoneFilter(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                  >
                    <option value="ALL">ALL ZONES</option>
                    <option value="LAG-METRO">LAG-METRO (Lagos)</option>
                    <option value="FCT-ABJ">FCT-ABJ (Abuja)</option>
                    <option value="KAN-NORTH">KAN-NORTH (Kano)</option>
                    <option value="RIV-DELTA">RIV-DELTA (Rivers)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Severity (?severity=)</Label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                  >
                    <option value="ALL">ALL SEVERITIES</option>
                    <option value="extreme">extreme</option>
                    <option value="warning">warning</option>
                    <option value="watch">watch</option>
                    <option value="advisory">advisory</option>
                  </select>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleRunPlayground}
                disabled={runningPlayground}
                className="w-full rounded-xl"
              >
                <Play className="mr-1.5 h-4 w-4" />
                {runningPlayground ? "Executing Request…" : `Send GET ${endpoint}`}
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-border bg-slate-950 p-5 text-slate-100 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <span className="font-mono text-xs text-emerald-400">
                    GET {queryUrl}
                  </span>
                  {playgroundResult && (
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-bold ${
                          playgroundResult.httpStatus === 200
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        HTTP {playgroundResult.httpStatus}
                      </span>
                      <span className="text-slate-400">{playgroundResult.latencyMs}ms</span>
                    </div>
                  )}
                </div>

                {playgroundResult ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2 font-mono text-[11px] text-slate-400">
                      {Object.entries(playgroundResult.headers).map(([hk, hv]) => (
                        <span
                          key={hk}
                          className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5"
                        >
                          {hk}: <strong className="text-slate-200">{hv}</strong>
                        </span>
                      ))}
                    </div>
                    <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-900/90 p-4 font-mono text-xs leading-relaxed text-slate-200">
                      <code>{JSON.stringify(playgroundResult.body, null, 2)}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="py-16 text-center font-mono text-xs text-slate-400">
                    Click &ldquo;Send GET {endpoint}&rdquo; to inspect the live JSON response and
                    rate-limit headers.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BUSINESS WEBHOOKS */}
        {activeTab === "webhooks" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <form
                onSubmit={handleCreateWebhook}
                className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4"
              >
                <div>
                  <p className="text-eyebrow">Real-Time Push Notifications</p>
                  <h2 className="mt-1 font-display text-lg font-bold">
                    Register Business Webhook Endpoint
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SafeAlert will send a signed HTTP POST (
                    <code className="text-foreground">X-SafeAlert-Signature</code>) to your server
                    within 2 seconds whenever an alert goes live.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Webhook Description</Label>
                  <Input
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="e.g. GIG Logistics Dispatch Router"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Target HTTPS URL</Label>
                  <Input
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    placeholder="https://api.yourcompany.ng/webhooks/safealert"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Subscribed Coverage Zones</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {["ALL", "LAG-METRO", "FCT-ABJ", "KAN-NORTH", "RIV-DELTA"].map((z) => {
                      const active = whZones.includes(z);
                      return (
                        <button
                          key={z}
                          type="button"
                          onClick={() =>
                            setWhZones((prev) =>
                              prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z],
                            )
                          }
                          className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
                            active
                              ? "border-primary bg-primary/15 text-primary font-bold"
                              : "border-border bg-surface text-muted-foreground"
                          }`}
                        >
                          {z}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button type="submit" className="w-full rounded-xl" disabled={creatingWh}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {creatingWh ? "Registering…" : "Register Webhook"}
                </Button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {webhooks.map((wh) => (
                <div key={wh.id} className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-success" />
                        <h3 className="font-display text-sm font-bold">{wh.name}</h3>
                        {wh.last_status_code && (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] font-bold text-success">
                            HTTP {wh.last_status_code}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{wh.target_url}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Zones: <strong className="text-foreground">{wh.zone_codes.join(", ")}</strong>{" "}
                        · Signing Secret:{" "}
                        <code className="select-all text-foreground">{wh.signing_secret}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={testingWhId === wh.id}
                        onClick={() => handleTestWebhook(wh.id)}
                      >
                        <Activity className="mr-1.5 h-3.5 w-3.5 text-primary" />
                        {testingWhId === wh.id ? "Sending…" : "Send Signed Test Event"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={async () => {
                          await deleteDeveloperWebhook({ data: { id: wh.id } });
                          toast.success("Webhook removed");
                          await refreshWorkspace();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {whTestResult && (
                <div className="rounded-2xl border border-border bg-slate-950 p-4 font-mono text-xs text-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-emerald-400">
                      Webhook Dispatch Result → {whTestResult.targetUrl}
                    </span>
                    <span>
                      HTTP {whTestResult.statusCode} ({whTestResult.latencyMs}ms)
                    </span>
                  </div>
                  <p className="mt-2 truncate text-[11px] text-slate-400">
                    X-SafeAlert-Signature: {whTestResult.signature}
                  </p>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px]">
                    <code>{JSON.stringify(whTestResult.requestPayload, null, 2)}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
