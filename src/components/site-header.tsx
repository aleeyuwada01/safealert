import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { to: "/" as const, label: "Platform" },
  { to: "/alerts" as const, label: "Live Feed" },
  { to: "/developers" as const, label: "Developers & API" },
  { to: "/integrations" as const, label: "Telco Architecture" },
  { to: "/security" as const, label: "Security" },
];

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          onClick={() => setMobileMenuOpen(false)}
        >
          <img
            src="/favicon.svg"
            alt="SafeAlert shield logo"
            className="h-9 w-9 shrink-0"
          />
          <div className="flex flex-col">
            <span className="font-display text-lg font-extrabold leading-none tracking-tight">
              <span className="text-foreground">Safe</span>
              <span className="text-primary">Alert</span>
            </span>
            <span className="mt-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
              Be Aware. Stay Safe.
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{
                className: "text-foreground font-semibold",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden rounded-lg font-semibold lg:inline-flex"
          >
            <Link to="/developers">Developer API</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="hidden rounded-lg font-semibold shadow-2xs sm:inline-flex"
          >
            <Link to="/console">
              Command Console <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
          {session && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
              className="hidden rounded-lg border-destructive/30 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive sm:inline-flex"
              title="Log out"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Log Out
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-card px-4 py-4 shadow-lg md:hidden">
          <nav className="flex flex-col space-y-1">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{
                  className: "bg-primary/10 text-primary font-semibold",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-border pt-3">
            <Button asChild className="w-full justify-center rounded-lg font-semibold">
              <Link to="/console" onClick={() => setMobileMenuOpen(false)}>
                Open Command Console <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
