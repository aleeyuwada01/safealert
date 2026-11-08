/**
 * Shared, browser-safe domain vocabulary and CAP 1.2 builders for the
 * National SafeAlert System. Used by both the public site and the operator console.
 */

export type Hazard = "flood" | "heatwave" | "security_threat" | "epidemic" | "other";
export type Severity = "advisory" | "watch" | "warning" | "extreme";
export type AlertStatus =
  | "draft"
  | "pending_approval"
  | "broadcasting"
  | "live"
  | "expired"
  | "cancelled";
export type ChannelKind = "cell_broadcast" | "sms" | "satellite" | "wifi_push" | "siren";
export type DeliveryStatus = "queued" | "dispatched" | "delivered" | "failed";

export const HAZARDS: { value: Hazard; label: string; tokenClass: string }[] = [
  { value: "flood", label: "Flood", tokenClass: "text-hazard-flood" },
  { value: "heatwave", label: "Heatwave", tokenClass: "text-hazard-heatwave" },
  { value: "security_threat", label: "Security Threat", tokenClass: "text-hazard-security" },
  { value: "epidemic", label: "Epidemic", tokenClass: "text-hazard-epidemic" },
  { value: "other", label: "Other Hazard", tokenClass: "text-hazard-other" },
];

export const SEVERITIES: { value: Severity; label: string; note: string }[] = [
  { value: "advisory", label: "Advisory", note: "Be aware — no siren" },
  { value: "watch", label: "Watch", note: "Prepare — short tone" },
  { value: "warning", label: "Warning", note: "Take action — full siren" },
  { value: "extreme", label: "Extreme", note: "Life threatening — override" },
];

export const CHANNELS: {
  value: ChannelKind;
  label: string;
  transport: string;
  protocol: string;
}[] = [
  {
    value: "cell_broadcast",
    label: "Cell Broadcast",
    transport: "Cellular",
    protocol: "3GPP CBS / CMAS",
  },
  { value: "sms", label: "Bulk SMS", transport: "Cellular", protocol: "SMPP 3.4" },
  {
    value: "satellite",
    label: "Satellite",
    transport: "Satellite",
    protocol: "NTN D2D / L-band",
  },
  { value: "wifi_push", label: "Wi-Fi Push", transport: "Wi-Fi", protocol: "WebPush / captive" },
  { value: "siren", label: "Siren Grid", transport: "IP", protocol: "SIP / RTP" },
];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yoruba" },
  { code: "ig", label: "Igbo" },
  { code: "pcm", label: "Nigerian Pidgin" },
];

export interface DrillTemplate {
  id: string;
  title: string;
  hazard: Hazard;
  severity: Severity;
  headline: string;
  message: string;
  instructions: string;
  languages: string[];
  sirenEnabled: boolean;
  expiresInHours: number;
}

export const DRILL_TEMPLATES: DrillTemplate[] = [
  {
    id: "flood-lagos",
    title: "Flash Flood — Ogun/Lagos Basin",
    hazard: "flood",
    severity: "warning",
    headline: "FLASH FLOOD WARNING: Ogun River Spillway Surge",
    message:
      "Rapid water level rise detected along the Ogun River and Lagos lagoon corridor. Low-lying districts face up to 1.4m inundation within the next 3 hours.",
    instructions:
      "Evacuate ground-floor premises immediately. Move to designated NEMA high-ground shelters. Never drive or walk across flooded roadways.",
    languages: ["en", "yo", "pcm"],
    sirenEnabled: true,
    expiresInHours: 12,
  },
  {
    id: "heatwave-kano",
    title: "Extreme Heat — Northern Corridor",
    hazard: "heatwave",
    severity: "extreme",
    headline: "EXTREME HEAT DANGER: 45°C+ Thermal Dome",
    message:
      "Life-threatening heat index exceeding 45°C across the Kano North corridor over the next 48 hours. High risk of heatstroke and grid peak load.",
    instructions:
      "Remain in shaded or cooled spaces between 11:00 and 16:00. Drink water every 30 minutes. Check on children and elderly neighbours.",
    languages: ["en", "ha"],
    sirenEnabled: true,
    expiresInHours: 48,
  },
  {
    id: "security-fct",
    title: "Security Lockdown — Metro Corridor",
    hazard: "security_threat",
    severity: "extreme",
    headline: "CIVIL SECURITY ALERT: Shelter-in-Place Directive",
    message:
      "Active security operation underway along the outer arterial highway. Citizens within the designated perimeter must remain indoors until cleared.",
    instructions:
      "Stay indoors, lock all entry points, keep away from windows, and keep phone lines clear for emergency responders. Dial 112 only for life-threatening emergencies.",
    languages: ["en", "ha", "pcm"],
    sirenEnabled: true,
    expiresInHours: 6,
  },
  {
    id: "epidemic-delta",
    title: "Waterborne Outbreak Watch",
    hazard: "epidemic",
    severity: "watch",
    headline: "PUBLIC HEALTH WATCH: Water Contamination Advisory",
    message:
      "Elevated cholera cluster indicators detected in flood-affected wards across the Delta basin following recent heavy rainfall.",
    instructions:
      "Boil or chlorinate all drinking water before use. Report acute symptoms immediately to the nearest primary healthcare centre.",
    languages: ["en", "ig", "pcm"],
    sirenEnabled: false,
    expiresInHours: 72,
  },
];

export function hazardLabel(hazard: Hazard) {
  return HAZARDS.find((h) => h.value === hazard)?.label ?? "Hazard";
}

export function channelLabel(channel: ChannelKind) {
  return CHANNELS.find((c) => c.value === channel)?.label ?? channel;
}

export function severityLabel(severity: Severity) {
  return SEVERITIES.find((s) => s.value === severity)?.label ?? severity;
}

export function hazardAccentClass(hazard: Hazard) {
  switch (hazard) {
    case "flood":
      return "bg-hazard-flood/15 text-hazard-flood border-hazard-flood/30";
    case "heatwave":
      return "bg-hazard-heatwave/15 text-hazard-heatwave border-hazard-heatwave/30";
    case "security_threat":
      return "bg-hazard-security/15 text-hazard-security border-hazard-security/30";
    case "epidemic":
      return "bg-hazard-epidemic/15 text-hazard-epidemic border-hazard-epidemic/30";
    default:
      return "bg-hazard-other/15 text-hazard-other border-hazard-other/30";
  }
}

export function statusClass(status: AlertStatus) {
  switch (status) {
    case "live":
      return "bg-signal/20 text-signal border-signal/40";
    case "broadcasting":
      return "bg-warning/20 text-warning border-warning/40";
    case "expired":
      return "bg-muted text-muted-foreground border-border";
    case "cancelled":
      return "bg-muted text-muted-foreground border-border";
    case "pending_approval":
      return "bg-accent/20 text-accent border-accent/40";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function statusLabel(status: AlertStatus) {
  return status.replace(/_/g, " ");
}

export function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

const CAP_SEVERITY_MAP: Record<Severity, string> = {
  advisory: "Minor",
  watch: "Moderate",
  warning: "Severe",
  extreme: "Extreme",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Browser-safe OASIS Common Alerting Protocol (CAP 1.2) XML builder. */
export function buildCapXmlDocument(input: {
  id: string;
  hazard: Hazard;
  severity: Severity;
  headline: string;
  message: string;
  instructions?: string | null;
  languages?: string[];
  sent?: string | null;
  expires?: string | null;
  status?: "Actual" | "Test";
  zones?: { code?: string; name: string }[];
}): string {
  const sentIso = input.sent || new Date().toISOString();
  const expiresIso = input.expires || new Date(Date.now() + 6 * 3_600_000).toISOString();
  const lang = input.languages?.[0] ?? "en";
  const category =
    input.hazard === "security_threat"
      ? "Security"
      : input.hazard === "epidemic"
        ? "Health"
        : "Met";
  const urgency = input.severity === "advisory" ? "Future" : "Immediate";
  const capSeverity = CAP_SEVERITY_MAP[input.severity] ?? "Severe";
  const areas =
    input.zones && input.zones.length > 0
      ? input.zones
      : [{ code: "NATIONAL", name: "National Broadcast Area" }];

  const areaXml = areas
    .map(
      (z) => `    <area>
      <areaDesc>${escapeXml(z.name)}</areaDesc>${
        z.code
          ? `\n      <geocode>\n        <valueName>SafeAlertZone</valueName>\n        <value>${escapeXml(z.code)}</value>\n      </geocode>`
          : ""
      }
    </area>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${escapeXml(input.id)}</identifier>
  <sender>alerts@safealert.live</sender>
  <sent>${escapeXml(sentIso)}</sent>
  <status>${input.status ?? "Actual"}</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>${escapeXml(lang)}</language>
    <category>${category}</category>
    <event>${escapeXml(input.headline)}</event>
    <urgency>${urgency}</urgency>
    <severity>${capSeverity}</severity>
    <certainty>Observed</certainty>
    <expires>${escapeXml(expiresIso)}</expires>
    <senderName>National SafeAlert Authority (NEMA)</senderName>
    <headline>${escapeXml(input.headline)}</headline>
    <description>${escapeXml(input.message)}</description>${
      input.instructions
        ? `\n    <instruction>${escapeXml(input.instructions)}</instruction>`
        : ""
    }
${areaXml}
  </info>
</alert>`;
}
