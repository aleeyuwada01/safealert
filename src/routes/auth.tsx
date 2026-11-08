import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Code2,
  Building2,
  KeyRound,
  LogIn,
  ExternalLink,
  MessageSquare,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — SafeAlert Command & Developer Portal" },
      {
        name: "description",
        content:
          "Sign in to the SafeAlert National Command Console (Operators) or the SafeAlert Developer & Business API Portal.",
      },
      { property: "og:title", content: "Sign In — SafeAlert" },
      {
        property: "og:description",
        content: "Access the SafeAlert Operator Console or Developer API Portal.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [portal, setPortal] = useState<"operator" | "developer">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("portal");
      if (p === "developer") return "developer";
    }
    return "operator";
  });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<"operator" | "developer" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInstantDemoLogin(
    targetPortal: "operator" | "developer",
    targetRoute: "/console" | "/console/network" | "/developers",
  ) {
    setDemoBusy(targetPortal);
    setError(null);
    setMessage(null);
    const demoEmail =
      targetPortal === "operator" ? "operator@safealert.live" : "dev@acme.ng";
    const demoPassword =
      targetPortal === "operator" ? "SafeAlert2026!" : "SafeAlertDev2026!";

    setPortal(targetPortal);
    setMode("signin");
    setEmail(demoEmail);
    setPassword(demoPassword);

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });
    setDemoBusy(null);
    if (signInErr) {
      setError(signInErr.message);
      return;
    }
    navigate({ to: targetRoute });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      navigate({ to: portal === "developer" ? "/developers" : "/console" });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${portal === "developer" ? "/developers" : "/console"}`,
        data: {
          full_name: fullName,
          agency:
            organization ||
            (portal === "developer" ? "Partner Organization" : "NEMA Operations"),
          account_type: portal,
        },
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (portal === "developer") {
      setMessage(
        "Developer account created! You can now sign in to generate API keys and configure webhooks.",
      );
      setMode("signin");
    } else {
      setMessage(
        "Operator account requested. An administrator must grant an operator role before you can issue national alerts.",
      );
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-surface/60 p-12 lg:flex">
        <Link to="/" className="inline-flex items-center gap-3">
          <img
            src="/safealert-logo.png"
            alt="SafeAlert"
            className="h-11 w-auto object-contain"
          />
        </Link>

        <div>
          <p className="text-eyebrow">
            {portal === "operator"
              ? "National Command Authority"
              : "Developer & Business API Ecosystem"}
          </p>
          <h2 className="mt-3 max-w-md font-display text-3xl font-extrabold leading-tight">
            {portal === "operator"
              ? "Unified Multi-Hazard Command Console"
              : "Connect Your Apps & Enterprise Systems to SafeAlert"}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            {portal === "operator"
              ? "Authorised command operators manage national emergency broadcasts, smart BulkSMS recipient directories with carrier DND compliance, and live WHO/NCDC pandemic surveillance."
              : "Provision API keys (sa_live_...), subscribe business webhooks for real-time CAP 1.2 hazard notifications, and query live WHO, NCDC, and meteorological feeds via REST."}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-xl border border-border bg-card p-3.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="mt-2 text-xs font-bold text-foreground">Command Operators</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Issue national alerts, manage BulkSMS directories &amp; telecom gateways.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <Code2 className="h-4 w-4 text-accent" />
              <p className="mt-2 text-xs font-bold text-foreground">Developers &amp; Businesses</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Create API keys, test REST endpoints &amp; subscribe webhooks.
              </p>
            </div>
          </div>
        </div>

        <p className="font-mono text-xs text-muted-foreground">
          OASIS CAP 1.2 · REST API v1 · HMAC-SHA256 Signed Webhooks
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2.5 lg:hidden">
            <img
              src="/safealert-logo.png"
              alt="SafeAlert"
              className="h-9 w-auto object-contain"
            />
          </Link>

          {/* Portal Switcher: Operator vs Developer */}
          <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-surface p-1.5 lg:mt-0">
            <button
              type="button"
              onClick={() => {
                setPortal("operator");
                setError(null);
                setMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                portal === "operator"
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Command Operator
            </button>
            <button
              type="button"
              onClick={() => {
                setPortal("developer");
                setError(null);
                setMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                portal === "developer"
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="h-3.5 w-3.5 text-accent" />
              Developer / Business
            </button>
          </div>

          <h1 className="mt-5 font-display text-2xl font-extrabold">
            {portal === "operator"
              ? mode === "signin"
                ? "Command Operator Sign In"
                : "Request Operator Access"
              : mode === "signin"
                ? "Developer & Partner Sign In"
                : "Create Developer API Account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {portal === "operator"
              ? "Authorised access to the National Command Console, Smart BulkSMS Directory, and Gateway Controls."
              : "Manage REST API keys (sa_live_...), webhook subscriptions, and enterprise integrations."}
          </p>

          {/* ALL DEMO ACCOUNTS & 1-CLICK DEMO LINKS VISIBLE AT ALL TIMES */}
          <div className="mt-4 space-y-2.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              All Demo Accounts &amp; 1-Click Portal Access
            </p>

            {/* 1. Command Operator / Admin Demo Box */}
            <div
              className={`rounded-xl border p-3.5 transition-all ${
                portal === "operator"
                  ? "border-primary/40 bg-primary/6"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-primary">
                    1. Admin &amp; Command Operator Demo
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 font-mono text-[10px]"
                    onClick={() => {
                      setPortal("operator");
                      setMode("signin");
                      setEmail("operator@safealert.live");
                      setPassword("SafeAlert2026!");
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    Auto-fill
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2.5 font-mono text-[10px]"
                    disabled={demoBusy !== null}
                    onClick={() => handleInstantDemoLogin("operator", "/console")}
                  >
                    <LogIn className="mr-1 h-3 w-3" />
                    {demoBusy === "operator" ? "Signing in…" : "1-Click Login → Console"}
                  </Button>
                </div>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
                <p>
                  Email: <span className="select-all text-foreground">operator@safealert.live</span>
                </p>
                <p>
                  Pass: <span className="select-all text-foreground">SafeAlert2026!</span>
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin("operator", "/console")}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Demo Command Dashboard (/console)
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin("operator", "/console/network")}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <MessageSquare className="h-2.5 w-2.5" />
                  Demo Smart BulkSMS Directory (/console/network)
                </button>
              </div>
            </div>

            {/* 2. Developer & Business API Demo Box */}
            <div
              className={`rounded-xl border p-3.5 transition-all ${
                portal === "developer"
                  ? "border-primary/40 bg-primary/6"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-accent" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                    2. Developer &amp; Business API Demo
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 font-mono text-[10px]"
                    onClick={() => {
                      setPortal("developer");
                      setMode("signin");
                      setEmail("dev@acme.ng");
                      setPassword("SafeAlertDev2026!");
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    Auto-fill
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-6 px-2.5 font-mono text-[10px] font-semibold"
                    disabled={demoBusy !== null}
                    onClick={() => handleInstantDemoLogin("developer", "/developers")}
                  >
                    <LogIn className="mr-1 h-3 w-3" />
                    {demoBusy === "developer" ? "Signing in…" : "1-Click Login → Dev API"}
                  </Button>
                </div>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
                <p>
                  Email: <span className="select-all text-foreground">dev@acme.ng</span>
                </p>
                <p>
                  Pass: <span className="select-all text-foreground">SafeAlertDev2026!</span>
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 font-mono text-[10px]">
                <Link
                  to="/developers"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Demo Developer API Keys &amp; Playground (/developers)
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  to="/alerts"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Activity className="h-2.5 w-2.5" />
                  Public Live Alerts &amp; WHO Feed (/alerts)
                </Link>
              </div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={portal === "developer" ? "Tunde Bakare" : "Cdr. Amina Bello"}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="organization">
                    {portal === "developer" ? "Company / Organization Name" : "Government Agency"}
                  </Label>
                  <Input
                    id="organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder={
                      portal === "developer"
                        ? "Acme Logistics Nigeria Ltd"
                        : "NEMA / NCDC Command"
                    }
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">
                {portal === "developer" ? "Work or developer email" : "Official operator email"}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                {message}
              </p>
            )}

            <Button type="submit" className="w-full rounded-xl" size="lg" disabled={busy}>
              {portal === "operator" ? (
                <ShieldCheck className="mr-2 h-4 w-4" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {busy
                ? "Authenticating…"
                : mode === "signin"
                  ? portal === "operator"
                    ? "Sign In to Command Console"
                    : "Sign In to Developer Portal"
                  : portal === "operator"
                    ? "Request Operator Access"
                    : "Create Developer Account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? portal === "operator"
                ? "Need operator clearance? Request an operator account"
                : "New partner or business? Create a developer API account"
              : "Already have credentials? Sign in"}
          </button>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5 font-mono text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              ← SafeAlert Home
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/alerts" className="hover:text-foreground">
                Live Feed
              </Link>
              <Link
                to="/developers"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Building2 className="h-3.5 w-3.5" />
                Developer Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
