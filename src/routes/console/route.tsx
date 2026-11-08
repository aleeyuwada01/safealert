import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/console")({
  component: ConsoleLayout,
});

const NAV_ITEMS = [
  { to: "/console" as const, label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/console/compose" as const, label: "Issue Alert", icon: Send, exact: false },
  { to: "/console/network" as const, label: "SMS Directory & Gateways", icon: Network, exact: false },
];

function ConsoleLayout() {
  const { session, user, loading, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [clock, setClock] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("safealert_sidebar_collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("safealert_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    const update = () => {
      setClock(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3.5 shadow-xs">
          <span className="pulse-healthy inline-block h-2.5 w-2.5 rounded-full bg-success" />
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Verifying operator session…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface/40 text-foreground">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-card transition-all duration-200 md:flex ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-3.5">
          <Link
            to="/"
            className={`flex items-center gap-2.5 overflow-hidden ${
              collapsed ? "justify-center w-full" : ""
            }`}
            title="SafeAlert — Be Aware. Stay Safe."
          >
            <img src="/favicon.svg" alt="SafeAlert" className="h-8 w-8 shrink-0" />
            {!collapsed && (
              <div className="truncate">
                <span className="block font-display text-base font-extrabold leading-none tracking-tight">
                  <span className="text-foreground">Safe</span>
                  <span className="text-primary">Alert</span>
                </span>
                <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Command Console
                </span>
              </div>
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-2.5">
          {!collapsed && (
            <p className="px-2.5 pb-1.5 pt-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Operations
            </p>
          )}
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              {...(item.exact ? { activeOptions: { exact: true } } : {})}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${
                collapsed ? "justify-center px-0" : ""
              }`}
              activeProps={{
                className:
                  "bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary",
              }}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}

          <div className="my-3 border-t border-border/70" />

          {!collapsed && (
            <p className="px-2.5 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Public &amp; Reference
            </p>
          )}
          <Link
            to="/alerts"
            title={collapsed ? "Public Alert Feed" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Public Alert Feed</span>}
          </Link>
          <Link
            to="/developers"
            title={collapsed ? "Developer API Portal" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Developer API Portal</span>}
          </Link>
        </nav>

        <div className="border-t border-border p-2.5">
          {!collapsed && (
            <div className="mb-2 rounded-lg border border-border/80 bg-surface/60 px-3 py-2">
              <p className="truncate text-xs font-semibold text-foreground">{user?.email}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                {roles.length > 0 ? roles.join(" · ") : "operator"}
              </p>
            </div>
          )}
          <div className={`flex items-center ${collapsed ? "flex-col gap-1.5" : "justify-between gap-2"}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
              title="Sign out"
              className={collapsed ? "h-9 w-9 p-0 text-muted-foreground" : "flex-1 justify-start text-muted-foreground"}
            >
              <LogOut className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
              {!collapsed && "Sign out"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={toggleSidebar}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-foreground/25 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col bg-card shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Radio className="h-4 w-4" />
                </span>
                <span className="font-display text-sm font-bold">SafeAlert Console</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  {...(item.exact ? { activeOptions: { exact: true } } : {})}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="border-t border-border p-3">
              <p className="truncate text-xs font-medium">{user?.email}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/auth" });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 text-muted-foreground hover:text-foreground md:inline-flex"
              onClick={toggleSidebar}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1">
              <span className="pulse-healthy inline-block h-2 w-2 rounded-full bg-success" />
              <span className="font-mono text-[11px] font-medium text-foreground">
                Live Network Connected
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {clock && (
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                {clock}
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
