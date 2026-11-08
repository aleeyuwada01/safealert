import { createFileRoute } from "@tanstack/react-router";
import { Activity, ShieldCheck, RadioTower, Smartphone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How SafeAlert Works — Detection to Delivery" },
      {
        name: "description",
        content:
          "Four stages: hazard detection, command centre validation, signal boost across cellular, Wi-Fi and satellite, then alert delivery to every phone.",
      },
      { property: "og:title", content: "How SafeAlert Works" },
      {
        property: "og:description",
        content:
          "Hazard detection, central command validation, multi-transport signal boost and device delivery.",
      },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  {
    icon: Activity,
    step: "Step 1",
    title: "Hazard detection",
    body: "Sensors and data centres detect threats in real time across seismic, meteorological, epidemiological and security networks. Feeds arrive as CAP 1.2 documents or REST webhooks and are normalised into a single hazard record.",
    detail: [
      "River gauge and rainfall telemetry (flood)",
      "Weather station heat index thresholds (heatwave)",
      "Security agency incident feeds (threat)",
      "Health surveillance case clusters (epidemic)",
    ],
  },
  {
    icon: ShieldCheck,
    step: "Step 2",
    title: "Central command hub",
    body: "The national command centre validates and activates each alert in the operator console. Every action is signed against an operator identity and written to an immutable audit log.",
    detail: [
      "Role-separated operators, approvers and administrators",
      "Draft, approval and broadcast states",
      "Full audit trail per alert",
      "Cancellation and update messages",
    ],
  },
  {
    icon: RadioTower,
    step: "Step 3",
    title: "Signal boost technology",
    body: "One approved alert fans out in parallel across satellite beams, cell broadcast centres, SMSC gateways, Wi-Fi hotspots and the municipal siren grid. A failure on one transport never blocks another.",
    detail: [
      "3GPP Cell Broadcast Write-Replace Warning",
      "SMPP 3.4 bulk delivery fallback",
      "Satellite NTN direct-to-device beams",
      "IP siren control over SIP/RTP",
    ],
  },
  {
    icon: Smartphone,
    step: "Step 4",
    title: "Emergency alerts to phones",
    body: "Siren and message override the phone's power and notification state, with acknowledgement collected back from each device to measure real reach.",
    detail: [
      "Non-dismissible presidential-class tone for extreme alerts",
      "Multi-language message bodies",
      "Evacuation map deep link",
      "Acknowledge button returns anonymous receipt counts",
    ],
  },
];

function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-eyebrow">Operational flow</p>
        <h1 className="mt-3 text-4xl font-extrabold">How it works</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          From the moment a hazard is measured to the moment a siren sounds, the network has four
          stages and no single point of failure.
        </p>

        <ol className="mt-12 space-y-6">
          {STEPS.map((step) => (
            <li
              key={step.step}
              className="relative rounded-lg border border-border bg-card p-6 sm:p-8"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <step.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-eyebrow">{step.step}</p>
                  <h2 className="mt-1 text-2xl font-bold">{step.title}</h2>
                  <p className="mt-3 text-sm text-muted-foreground">{step.body}</p>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {step.detail.map((d) => (
                      <li
                        key={d}
                        className="rounded-md border border-border/70 bg-surface/60 px-3 py-2 font-mono text-xs text-muted-foreground"
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}
