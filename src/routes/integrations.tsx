import { createFileRoute } from "@tanstack/react-router";
import { RadioTower, Satellite, Wifi, MessageSquare, Siren } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CHANNELS } from "@/lib/safealert";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Cellular & Satellite Integration Guide — SafeAlert" },
      {
        name: "description",
        content:
          "Step-by-step guidance for connecting SafeAlert to mobile operator cell broadcast centres, SMPP gateways, satellite NTN providers and Wi-Fi hotspot networks.",
      },
      { property: "og:title", content: "Cellular & Satellite Integration Guide" },
      {
        property: "og:description",
        content:
          "Gateway credentials, protocols, provisioning steps and test plans for every SafeAlert delivery channel.",
      },
    ],
  }),
  component: Integrations,
});

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-surface/70 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Section({
  id,
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  id: string;
  icon: typeof RadioTower;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-border bg-card p-6 sm:p-8">
      <Icon className="h-5 w-5 text-accent" />
      <p className="text-eyebrow mt-4">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold">{title}</h2>
      <div className="mt-4 space-y-4 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={item} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 font-mono text-[11px] text-primary">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Integrations() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-eyebrow">Integration guide</p>
        <h1 className="mt-3 text-4xl font-extrabold">Cellular &amp; satellite integration</h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          SafeAlert never talks to handsets directly. It authors one signed alert and hands it to
          registered gateways — a mobile operator's cell broadcast centre, an SMSC, a satellite
          provider's messaging API, or a Wi-Fi hotspot controller. Register a gateway in the operator
          console, store its credential as a backend secret, and the dispatcher starts using it.
        </p>

        <div className="mt-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="bg-surface/70 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Transport</th>
                <th className="px-4 py-3">Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CHANNELS.map((c) => (
                <tr key={c.value}>
                  <td className="px-4 py-3 font-medium text-foreground">{c.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.transport}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.protocol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 space-y-6">
          <Section
            id="cell-broadcast"
            icon={RadioTower}
            eyebrow="Cellular · primary path"
            title="Cell Broadcast (3GPP CBS / CMAS / ETWS)"
          >
            <p>
              Cell broadcast is the only channel that reaches every handset in a coverage area
              simultaneously, with no phone numbers, no subscriber list and no network congestion. It
              is the path used for extreme, life-threatening alerts.
            </p>
            <Steps
              items={[
                "Sign a public warning agreement with each mobile network operator (MNO) and obtain authority approval from the designated national alerting authority.",
                "Ask the MNO to provision a Cell Broadcast Entity (CBE) account on their Cell Broadcast Centre (CBC), and request the CBC endpoint URL plus mutual-TLS client certificate.",
                "Agree the message identifier range and warning categories: 4370 (presidential/extreme, non-dismissible), 4371-4378 (extreme), 4379-4382 (severe), 4383-4386 (advisory).",
                "Agree geo-targeting granularity: Tracking Area (TAI) list, eNodeB/gNodeB list, or Cell Global Identity list. Store the mapping from SafeAlert zone codes to those cell identities in the zones table.",
                "Register the gateway in the console (kind: cell_broadcast) with the CBC base URL, and save the certificate/API key as a backend secret. The dispatcher sends the Write-Replace Warning request per zone.",
                "Run the MNO's staged test plan: lab handset test, single-cell live test at low traffic hour, then a nationwide silent test with the siren tone suppressed.",
              ]}
            />
            <p>
              The dispatcher issues a Write-Replace Warning per zone and treats the CBC's
              acknowledgement as a dispatch receipt. Cancellation sends a Stop Warning for the same
              message identifier and serial number.
            </p>
            <Code>{`POST {CBC_BASE_URL}/cbc/v1/warning-request
Authorization: Bearer {CBC_API_KEY}      # or mutual TLS client cert
Content-Type: application/json

{
  "messageIdentifier": 4370,
  "serialNumber": 12801,
  "warningType": "flood",
  "repetitionPeriod": 32,
  "numberOfBroadcasts": 6,
  "warningAreaList": { "cellIdList": ["62130-1001", "62130-1002"] },
  "warningMessage": {
    "dataCodingScheme": "GSM7",
    "text": "FLOOD WARNING: Move to higher ground now. -SafeAlert"
  }
}`}</Code>
          </Section>

          <Section
            id="sms"
            icon={MessageSquare}
            eyebrow="Cellular · BulkSMS Nigeria v2 & SMPP 3.4"
            title="BulkSMS Nigeria API v2 / Sandbox v2 & Bulk SMS"
          >
            <p>
              SafeAlert includes native first-class support for{" "}
              <strong className="text-foreground">BulkSMS Nigeria API v2</strong> (Production{" "}
              <code className="text-foreground">https://www.bulksmsnigeria.com/api/v2</code> and
              Sandbox{" "}
              <code className="text-foreground">https://www.bulksmsnigeria.com/api/sandbox/v2</code>
              ), including <code className="text-foreground">POST /sms</code>,{" "}
              <code className="text-foreground">POST /voice/create</code>,{" "}
              <code className="text-foreground">GET /balance</code>, delivery webhooks, and full{" "}
              <code className="text-foreground">BSNG-0000</code> to{" "}
              <code className="text-foreground">BSNG-5004</code> error handling with exponential
              backoff on 5xx errors.
            </p>
            <Steps
              items={[
                "Configure your API token via BULKSMS_NIGERIA_API_TOKEN (or enter it interactively in /console/network under the BulkSMS Nigeria v2 tab).",
                "Test your integration against the zero-cost Sandbox API (https://www.bulksmsnigeria.com/api/sandbox/v2/sms) before switching to Production (https://www.bulksmsnigeria.com/api/v2/sms).",
                "Choose your gateway route: direct-refund (default), direct-corporate, corporate, otp, or international, and register an approved Sender ID (max 11 chars, e.g., SafeAlert).",
                "Pass callback_url with a secret token to receive per-recipient Delivery Webhooks: treat delivrd, delivered, and success as delivered, and all other network status codes (undeliv, expired, rejectd, failed) as failed.",
                "Use POST /api/v2/voice/create (rate-limited to 10 req/min) to deliver automated text-to-speech voice phone calls alongside SMS.",
              ]}
            />
            <Code>{`# Production: https://www.bulksmsnigeria.com/api/v2/sms
# Sandbox:    https://www.bulksmsnigeria.com/api/sandbox/v2/sms
POST https://www.bulksmsnigeria.com/api/v2/sms
Authorization: Bearer {BULKSMS_NIGERIA_API_TOKEN}
Content-Type: application/json
Accept: application/json

{
  "from": "SafeAlert",
  "to": "2347037770033,2349050030090",
  "body": "[SAFEALERT EXTREME] Ebola Virus Surveillance Alert: Report fever or bleeding to 6232 immediately.",
  "gateway": "direct-refund",
  "append_sender": "hosted",
  "unicode": false,
  "callback_url": "https://safealert.live/webhooks/sms?secret=YOUR_LONG_RANDOM_SECRET",
  "customer_reference": "alert-ebola-622"
}`}</Code>
          </Section>

          <Section
            id="satellite"
            icon={Satellite}
            eyebrow="Satellite · out-of-band path"
            title="Satellite NTN direct-to-device & L-band broadcast"
          >
            <p>
              The satellite path exists for two cases: zones with no terrestrial coverage, and a
              terrestrial outage during the disaster itself. Because it does not depend on any ground
              network, it is the most survivable route and should always be enabled for extreme
              alerts.
            </p>
            <Steps
              items={[
                "Choose a provider model: 3GPP NTN direct-to-device (works with unmodified recent handsets over partner spectrum), L-band/S-band broadcast to receiver-equipped devices and community sirens, or both.",
                "Sign a capacity contract that specifies beam coverage over national territory, priority pre-emption for emergency traffic, and a guaranteed time-to-first-broadcast.",
                "Obtain from the provider: messaging API base URL, API key or mTLS certificate, your account/authority identifier, and the beam identifiers covering each zone.",
                "Map SafeAlert zone codes to beam identifiers and store the mapping alongside each zone. Rural zones usually map to a single wide beam.",
                "Register the gateway (kind: satellite) with the provider endpoint and store the API key as a backend secret.",
                "For community terminals, deploy satellite-connected siren controllers at ward level so an alert can sound with no mobile network present.",
                "Test quarterly with a silent broadcast, and verify the acknowledgement counts returned per beam.",
              ]}
            />
            <Code>{`POST {SAT_API_BASE}/v1/broadcast
Authorization: Bearer {SAT_API_KEY}
X-Authority-Id: {AUTHORITY_ID}

{
  "priority": "emergency",
  "beams": ["AF-W-01", "AF-W-04"],
  "ttlSeconds": 1800,
  "payload": {
    "format": "cap-1.2",
    "body": "<alert xmlns=\\"urn:oasis:names:tc:emergency:cap:1.2\\">…</alert>"
  }
}`}</Code>
            <p>
              SafeAlert emits a canonical CAP 1.2 document for every alert, so any provider that
              accepts CAP can be added without changing the alert authoring flow.
            </p>
          </Section>

          <Section
            id="wifi"
            icon={Wifi}
            eyebrow="Wi-Fi · dense urban path"
            title="Wi-Fi push & captive portal interstitials"
          >
            <p>
              In dense urban areas and inside buildings, Wi-Fi often works when cellular is saturated.
            </p>
            <Steps
              items={[
                "Work with public hotspot operators, transport hubs and campuses to add an emergency interstitial to their captive portal controller.",
                "Expose the SafeAlert live-alert endpoint to the controller so it can display the current alert for the hotspot's zone.",
                "For the SafeAlert mobile app, register VAPID keys for WebPush and dispatch with topic collapse so repeat broadcasts replace rather than stack.",
                "Register the gateway (kind: wifi_push) with the controller or push service endpoint.",
              ]}
            />
          </Section>

          <Section
            id="siren"
            icon={Siren}
            eyebrow="IP · community path"
            title="Municipal siren grid"
          >
            <p>
              Outdoor sirens cover people with no phone at all. SafeAlert triggers siren controllers
              over an IP control channel and treats each controller as a gateway with its own health
              heartbeat.
            </p>
            <Steps
              items={[
                "Inventory existing municipal sirens and assign each to a SafeAlert zone code.",
                "Fit IP-capable controllers with battery backup and, where possible, a satellite terminal.",
                "Register each controller cluster (kind: siren) and confirm the heartbeat appears healthy in the console.",
                "Run monthly audible tests at a published time so the public learns the tone.",
              ]}
            />
          </Section>

          <Section
            id="webhook-verification"
            icon={RadioTower}
            eyebrow="Webhook Security & Verification"
            title="HMAC-SHA256 Signature Verification & Environment Secrets"
          >
            <p>
              Every HTTP POST dispatched by SafeAlert to a telecom CBC, SMS aggregator, satellite
              gateway, or Wi-Fi controller includes cryptographic authentication headers so your
              gateway can verify origin before broadcasting:
            </p>
            <Code>{`X-SafeAlert-Authority: NEMA-NG-SAFEALERT
X-SafeAlert-Channel: cell_broadcast | sms | satellite | wifi_push | siren
X-SafeAlert-Timestamp: 2026-11-08T12:00:00.000Z
X-SafeAlert-Signature: sha256=<hex_hmac_sha256_of_timestamp_dot_raw_body>`}</Code>
            <p>
              Verify the signature on your receiving gateway using your shared{" "}
              <code className="text-foreground">SAFEALERT_SIGNING_SECRET</code>:
            </p>
            <Code>{`// Node.js / Express Provider Gateway Verification Example
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySafeAlertWebhook(rawBody: string, timestamp: string, signatureHeader: string, secret: string) {
  const expected = "sha256=" + createHmac("sha256", secret).update(\`\${timestamp}.\${rawBody}\`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}`}</Code>
            <p>
              Every registered gateway with an active <code className="text-foreground">https://</code>{" "}
              endpoint receives a real, signed HTTP POST containing both the channel-specific JSON
              body and the full OASIS CAP 1.2 XML document. You can send live diagnostic probes to
              any provider endpoint from the{" "}
              <a href="/console/network" className="text-primary underline">
                Network &amp; Provider Gateways Console
              </a>
              .
            </p>
            <Steps
              items={[
                "Open /console/network and use the Live Provider Webhook Probe to send a signed TEST payload to your gateway endpoint.",
                "Set CBC_ENDPOINT / CBC_API_KEY, SMPP_HTTP_ENDPOINT / SMPP_API_KEY, or SATELLITE_ENDPOINT / SATELLITE_API_KEY in your environment, or register an https:// endpoint directly on the gateway row.",
                "Verify the X-SafeAlert-Signature header and CAP 1.2 XML/JSON body on your receiving bridge.",
                "Complete your staged handset lab test and silent single-cell broadcast test.",
              ]}
            />
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
