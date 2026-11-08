import { createFileRoute } from "@tanstack/react-router";
import { Lock, ServerCog, BatteryCharging, GitBranch } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security & Reliability — National SafeAlert" },
      {
        name: "description",
        content:
          "End-to-end encrypted alert transmission, redundant backup power for 99.99% uptime, and failover across geographically distributed servers.",
      },
      { property: "og:title", content: "Security & Reliability — National SafeAlert" },
      {
        property: "og:description",
        content:
          "Encryption, authority controls, backup power and geographic failover behind the national warning network.",
      },
    ],
  }),
  component: SecurityPage,
});

const PILLARS = [
  {
    icon: Lock,
    title: "Encrypted alert transmission",
    points: [
      "TLS 1.3 with mutual certificates on every gateway link",
      "Alerts signed with an authority key before dispatch; gateways reject unsigned messages",
      "CAP 1.2 digital signature so telecom partners can verify origin independently",
      "Least-privilege database policies — operators can never escalate their own role",
    ],
  },
  {
    icon: BatteryCharging,
    title: "Backup power, 99.99% uptime",
    points: [
      "Dual-feed utility plus UPS and generator at command sites",
      "Battery-backed siren controllers keep sounding through grid failure",
      "Gateway heartbeats every 30 seconds with automatic health downgrade",
      "Degraded gateways are skipped, not queued, so alerts never stall",
    ],
  },
  {
    icon: GitBranch,
    title: "Geographic failover",
    points: [
      "Command hub deployed to multiple regions behind an anycast edge",
      "Primary and secondary cell broadcast centres per mobile operator",
      "Satellite path acts as the out-of-band route when terrestrial links drop",
      "Every dispatch attempt is recorded per channel and per zone for after-action review",
    ],
  },
  {
    icon: ServerCog,
    title: "Authority & accountability",
    points: [
      "Separate operator, approver and administrator roles",
      "Immutable audit log of every issue, approval and cancellation",
      "Two-person rule available for presidential-class extreme alerts",
      "Anonymous acknowledgement counts only — no citizen identity is stored",
    ],
  },
];

function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-eyebrow">Trust model</p>
        <h1 className="mt-3 text-4xl font-extrabold">Security &amp; reliability</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          A warning network is only as credible as its worst day. These are the controls that keep the
          system trustworthy under load, attack and blackout.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {PILLARS.map((pillar) => (
            <section key={pillar.title} className="rounded-lg border border-border bg-card p-6">
              <pillar.icon className="h-5 w-5 text-accent" />
              <h2 className="mt-4 text-xl font-bold">{pillar.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {pillar.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-lg border border-warning/40 bg-warning/10 p-6">
          <h2 className="text-lg font-bold text-warning">Pre-launch requirements</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Before national go-live, the following must be signed off outside this platform: an
            authority agreement with the national alerting authority defining who may issue presidential-class alerts, cell
            broadcast provisioning agreements with each mobile network operator, a satellite capacity
            contract, and handset firmware agreements for powered-off siren delivery.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
