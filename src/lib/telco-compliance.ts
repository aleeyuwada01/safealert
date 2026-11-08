export interface TelcoViolation {
  matched: string;
  category: "phishing_block" | "promo_dnd_block" | "spam_trigger" | "unicode_cost";
  reason: string;
  replacement: string;
}

export interface TelcoComplianceReport {
  isClean: boolean;
  violations: TelcoViolation[];
  sanitizedText: string;
  charCount: number;
  pageCount: number;
  encoding: "GSM-7" | "UNICODE";
}

interface BlockRule {
  pattern: RegExp;
  label: string;
  category: TelcoViolation["category"];
  reason: string;
  replacement: string;
}

/**
 * Nigerian MNO (MTN, Airtel, Glo, 9mobile) & BulkSMS gateway block-word rules.
 * Ensures emergency broadcasts never trip DND, anti-phishing, or promotional filters.
 */
const TELCO_BLOCK_RULES: BlockRule[] = [
  {
    pattern: /\bBVN\b/gi,
    label: "BVN",
    category: "phishing_block",
    reason: "Hard-blocked by NCC/MNO anti-fraud filters",
    replacement: "ID",
  },
  {
    pattern: /\b(PIN|PASSWORD|CVV|OTP)\b/gi,
    label: "PIN/PASSWORD/OTP",
    category: "phishing_block",
    reason: "Flagged by MNO banking phishing filters",
    replacement: "ACCESS CODE",
  },
  {
    pattern: /\bACCOUNT\s+BLOCKED\b/gi,
    label: "ACCOUNT BLOCKED",
    category: "phishing_block",
    reason: "Blocked by MNO financial scam rules",
    replacement: "STATUS UPDATE",
  },
  {
    pattern: /\b(?<!TOLL[- ])FREE\b/gi,
    label: "FREE",
    category: "promo_dnd_block",
    reason: "Triggers promotional DND filter unless hyphenated as TOLL-FREE",
    replacement: "TOLL-FREE",
  },
  {
    pattern: /\b(WIN|WINNER|WON|LOTTERY|JACKPOT|RAFFLE)\b/gi,
    label: "WIN/LOTTERY",
    category: "promo_dnd_block",
    reason: "Blocked on corporate & direct-refund routes as lottery/promo traffic",
    replacement: "NOTICE",
  },
  {
    pattern: /\b(PROMO|PROMOTION|BONUS|DISCOUNT|CASH\s*PRIZE|MILLIONAIRE)\b/gi,
    label: "PROMO/BONUS",
    category: "promo_dnd_block",
    reason: "Classified as commercial marketing; dropped on DND lines",
    replacement: "PUBLIC BULLETIN",
  },
  {
    pattern: /\bCONGRATULATIONS\b/gi,
    label: "CONGRATULATIONS",
    category: "promo_dnd_block",
    reason: "High-risk scam keyword across Nigerian SMSC binds",
    replacement: "ATTENTION",
  },
  {
    pattern: /\b(BET|BETTING|CASINO|LOAN\s+OFFER)\b/gi,
    label: "BET/LOAN",
    category: "promo_dnd_block",
    reason: "Restricted gaming/lending keyword on emergency routes",
    replacement: "ADVISORY",
  },
  {
    pattern: /\bCLICK\s+HERE\b/gi,
    label: "CLICK HERE",
    category: "spam_trigger",
    reason: "Phishing CTA blocked by carrier firewall",
    replacement: "SEE OFFICIAL PORTAL",
  },
  {
    pattern: /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl)\/\S+/gi,
    label: "Shortened URL",
    category: "spam_trigger",
    reason: "Public URL shorteners are blacklisted by Nigerian MNOs",
    replacement: "safealert.live",
  },
  {
    pattern: /\bACT\s+NOW\b/gi,
    label: "ACT NOW",
    category: "spam_trigger",
    reason: "Marketing urgency phrase flagged by spam filters",
    replacement: "FOLLOW GUIDANCE",
  },
  {
    pattern: /!{2,}/g,
    label: "Multiple Exclamations (!!!)",
    category: "spam_trigger",
    reason: "Excessive punctuation triggers carrier spam scoring",
    replacement: ".",
  },
  {
    pattern: /₦/g,
    label: "Naira Symbol (₦)",
    category: "unicode_cost",
    reason: "Forces 70-char Unicode billing instead of 160-char GSM-7",
    replacement: "NGN ",
  },
];

export function analyzeTelcoCompliance(text: string): TelcoComplianceReport {
  const violations: TelcoViolation[] = [];
  let sanitized = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");

  for (const rule of TELCO_BLOCK_RULES) {
    const matches = sanitized.match(rule.pattern);
    if (matches && matches.length > 0) {
      violations.push({
        matched: matches[0],
        category: rule.category,
        reason: rule.reason,
        replacement: rule.replacement,
      });
      sanitized = sanitized.replace(rule.pattern, rule.replacement);
    }
  }

  sanitized = sanitized.replace(/\s{2,}/g, " ").trim();

  // Check if non-GSM7 characters remain
  // eslint-disable-next-line no-control-regex
  const hasUnicode = /[^\x00-\x7F]/.test(text);
  const encoding = hasUnicode ? "UNICODE" : "GSM-7";
  const charCount = text.length;
  const pageCount =
    charCount === 0
      ? 0
      : encoding === "UNICODE"
        ? charCount <= 70
          ? 1
          : Math.ceil(charCount / 67)
        : charCount <= 160
          ? 1
          : Math.ceil(charCount / 153);

  return {
    isClean: violations.length === 0,
    violations,
    sanitizedText: sanitized,
    charCount,
    pageCount,
    encoding,
  };
}

export interface NormalizedPhoneEntry {
  phone_number: string;
  network: "MTN" | "Airtel" | "Glo" | "9mobile" | "International";
  valid: boolean;
}

const MTN_PREFIXES = new Set([
  "0803", "0806", "0703", "0704", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916",
]);
const AIRTEL_PREFIXES = new Set([
  "0802", "0808", "0701", "0708", "0812", "0901", "0902", "0904", "0907", "0912", "0911",
]);
const GLO_PREFIXES = new Set([
  "0805", "0807", "0705", "0811", "0815", "0905", "0915",
]);
const NINEMOBILE_PREFIXES = new Set([
  "0809", "0817", "0818", "0908", "0909",
]);

export function detectNigerianNetwork(msisdn234: string): NormalizedPhoneEntry["network"] {
  if (!msisdn234.startsWith("234") || msisdn234.length !== 13) {
    return "International";
  }
  const localPrefix = "0" + msisdn234.slice(3, 6);
  if (MTN_PREFIXES.has(localPrefix)) return "MTN";
  if (AIRTEL_PREFIXES.has(localPrefix)) return "Airtel";
  if (GLO_PREFIXES.has(localPrefix)) return "Glo";
  if (NINEMOBILE_PREFIXES.has(localPrefix)) return "9mobile";
  return "MTN";
}

export function normalizeNigerianPhone(raw: string): NormalizedPhoneEntry {
  const digits = raw.replace(/\D/g, "");
  let normalized = digits;

  if (digits.startsWith("0") && digits.length === 11) {
    normalized = "234" + digits.slice(1);
  } else if (digits.length === 10 && /^[789][01]\d{8}$/.test(digits)) {
    normalized = "234" + digits;
  } else if (digits.startsWith("2340") && digits.length === 14) {
    normalized = "234" + digits.slice(4);
  }

  const valid = /^234[789][01]\d{8}$/.test(normalized) || (normalized.length >= 11 && normalized.length <= 15);
  return {
    phone_number: normalized,
    network: detectNigerianNetwork(normalized),
    valid,
  };
}

export function parseBulkPhoneNumbers(rawInput: string): NormalizedPhoneEntry[] {
  const tokens = rawInput
    .split(/[\s,;|\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const results: NormalizedPhoneEntry[] = [];
  for (const token of tokens) {
    const entry = normalizeNigerianPhone(token);
    if (entry.valid && !seen.has(entry.phone_number)) {
      seen.add(entry.phone_number);
      results.push(entry);
    }
  }
  return results;
}

export interface PredefinedSmsTemplate {
  id: string;
  label: string;
  hazard: string;
  zone_code: string;
  body: string;
}

export const PREDEFINED_SMS_TEMPLATES: PredefinedSmsTemplate[] = [
  {
    id: "ebola-surveillance",
    label: "Ebola Virus Surveillance Advisory (WHO / NCDC)",
    hazard: "epidemic",
    zone_code: "ALL",
    body: "SAFEALERT HEALTH ADVISORY: Heightened Ebola virus surveillance active across Nigeria. Avoid contact with bodily fluids of febrile persons. Report sudden high fever or unexplained bleeding to NCDC Toll-Free 6232.",
  },
  {
    id: "lassa-cholera-sitrep",
    label: "Lassa Fever & Cholera Hygiene Directive (NCDC)",
    hazard: "epidemic",
    zone_code: "ALL",
    body: "SAFEALERT NCDC BULLETIN: Lassa fever and Cholera prevention active. Store food in rodent-proof containers, boil drinking water, and report persistent fever to the nearest health facility or dial 6232.",
  },
  {
    id: "flood-evacuation",
    label: "Flash Flood Evacuation Order (NEMA)",
    hazard: "flood",
    zone_code: "LAG-METRO",
    body: "SAFEALERT FLOOD WARNING: Rising water levels detected in low-lying floodplains. Move to designated higher ground immediately. Do not drive or walk through moving floodwater. Emergency line: 112.",
  },
  {
    id: "heatwave-advisory",
    label: "Extreme Heatwave Advisory (NiMet / NEMA)",
    hazard: "heatwave",
    zone_code: "KAN-NORTH",
    body: "SAFEALERT HEAT WARNING: Extreme temperatures above 42C forecast between 11:00 and 16:00. Drink clean water regularly, limit midday outdoor labour, and check on elderly neighbours. Emergency line: 112.",
  },
  {
    id: "security-shelter",
    label: "Civil Security Shelter-in-Place Directive",
    hazard: "security_threat",
    zone_code: "FCT-ABJ",
    body: "SAFEALERT SECURITY DIRECTIVE: Security operations underway in designated corridor. Remain indoors, avoid restricted intersections, and monitor official SafeAlert bulletins. Emergency line: 112.",
  },
  {
    id: "all-clear",
    label: "All-Clear / Normalcy Restored Notice",
    hazard: "other",
    zone_code: "ALL",
    body: "SAFEALERT ALL-CLEAR: Previous emergency advisory has been lifted by national authorities. Normal movement and activities may resume safely. Thank you for your cooperation.",
  },
];

export function buildTelcoSafeAlertMessage(
  alerts: Array<{ headline: string; severity: string; hazard: string; instructions?: string | null; message: string }>,
): string {
  const firstAlert = alerts[0];
  if (!firstAlert) {
    return PREDEFINED_SMS_TEMPLATES[0]?.body ?? "SAFEALERT ADVISORY: Monitor official bulletins.";
  }
  if (alerts.length === 1) {
    const prefix = `SAFEALERT ${firstAlert.severity.toUpperCase()}: ${firstAlert.headline}.`;
    const body = firstAlert.instructions
      ? `${firstAlert.message} Action: ${firstAlert.instructions}`
      : firstAlert.message;
    const raw = `${prefix} ${body} Help: 112 / NCDC 6232`;
    return analyzeTelcoCompliance(raw).sanitizedText;
  }
  const summary = alerts
    .slice(0, 3)
    .map((a, i) => `${i + 1}) [${a.severity.toUpperCase()}] ${a.headline}`)
    .join("; ");
  const raw = `SAFEALERT MULTI-HAZARD DIGEST (${alerts.length} Active): ${summary}. Follow official guidance at safealert.live or dial 112 / 6232.`;
  return analyzeTelcoCompliance(raw).sanitizedText;
}
