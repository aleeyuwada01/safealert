import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div className="space-y-2">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <img src="/favicon.svg" alt="SafeAlert" className="h-8 w-8" />
              <span className="font-display text-lg font-extrabold tracking-tight">
                <span className="text-foreground">Safe</span>
                <span className="text-primary">Alert</span>
              </span>
            </Link>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Be Aware. Stay Safe. Unified multi-hazard warning infrastructure across cellular
              broadcast, BulkSMS v2, direct-to-device satellite, Wi-Fi, and municipal siren grids.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm font-medium text-muted-foreground">
            <Link to="/alerts" className="transition-colors hover:text-foreground">
              Live Feed
            </Link>
            <Link to="/developers" className="transition-colors hover:text-foreground">
              Developers &amp; API
            </Link>
            <Link to="/integrations" className="transition-colors hover:text-foreground">
              Telco Architecture
            </Link>
            <Link to="/security" className="transition-colors hover:text-foreground">
              Security &amp; Compliance
            </Link>
            <Link to="/console" className="transition-colors hover:text-foreground">
              Command Console
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-6 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} SafeAlert (safealert.live). All rights reserved.</p>
          <p className="font-mono text-[11px]">
            OASIS CAP 1.2 · REST API v1 · 3GPP TS 23.041 CBS · HMAC-SHA256
          </p>
        </div>
      </div>
    </footer>
  );
}
