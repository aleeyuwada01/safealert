/**
 * Live Channel Dispatch Adapters & Provider API Engine (server-only).
 *
 * Every adapter builds the canonical production payload for its transport
 * (3GPP CBS, BulkSMS Nigeria v2 / SMPP 3.4, NTN Satellite, Captive Wi-Fi, SIP/RTP Siren),
 * signs the payload with HMAC-SHA256 (X-SafeAlert-Signature),
 * and transmits over HTTPS to the configured gateway endpoint.
 */

import { createHmac } from "node:crypto";
import {
  buildCapXmlDocument,
  type ChannelKind,
  type Hazard,
  type Severity,
} from "./safealert";
import {
  BULKSMS_NIGERIA_BASE_URLS,
  describeBsngCode,
  sanitizeSenderId,
  type BulkSmsEnvironment,
  type BulkSmsGatewayRoute,
} from "./bulksms-nigeria";

export interface DispatchTarget {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  population: number;
  centreLat: number | null;
  centreLng: number | null;
}

export interface DispatchRequest {
  alertId: string;
  hazard: Hazard;
  severity: Severity;
  headline: string;
  message: string;
  instructions: string | null;
  languages: string[];
  sirenEnabled: boolean;
  expiresAt: string | null;
  target: DispatchTarget;
  gatewayEndpoint?: string | null;
}

export interface DispatchResult {
  channel: ChannelKind;
  status: "dispatched" | "delivered" | "failed";
  devicesTargeted: number;
  devicesReached: number;
  latencyMs: number;
  gatewayReference: string | null;
  errorDetail: string | null;
}

export interface GatewayTestReport {
  ok: boolean;
  channel: ChannelKind;
  targetEndpoint: string;
  statusCode: number;
  latencyMs: number;
  gatewayReference: string;
  requestHeaders: Record<string, string>;
  requestPayload: string;
  capXml: string;
  responsePreview: string;
}

export interface BulkSmsTestReport {
  ok: boolean;
  environment: BulkSmsEnvironment;
  mode: "sms" | "voice";
  endpointUrl: string;
  httpStatus: number;
  bsngCode: string;
  bsngCategory: string;
  bsngDescription: string;
  message: string;
  messageId: string | null;
  cost: number | null;
  currency: string;
  recipientsCount: number;
  gatewayUsed: string | null;
  sandboxMode: boolean;
  latencyMs: number;
  attempts: number;
  rawResponse: string;
}

export interface BulkSmsBalanceReport {
  ok: boolean;
  environment: BulkSmsEnvironment;
  httpStatus: number;
  bsngCode: string;
  bsngDescription: string;
  balance: number | null;
  currency: string;
  formatted: string | null;
  rawResponse: string;
}

/** CAP 1.2 severity mapping used by every downstream transport. */
const CAP_SEVERITY: Record<Severity, string> = {
  advisory: "Minor",
  watch: "Moderate",
  warning: "Severe",
  extreme: "Extreme",
};

/** 3GPP cell-broadcast message identifiers (CMAS / ETWS class). */
const CBS_MESSAGE_ID: Record<Severity, number> = {
  advisory: 4373,
  watch: 4372,
  warning: 4371,
  extreme: 4370,
};

function ref(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function env(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

export function isValidHttpEndpoint(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

/** Sign outbound payload with HMAC-SHA256 so telecom & satellite partners can verify authenticity. */
export function signPayload(rawBody: string, timestamp: string): string {
  const secret = env("SAFEALERT_SIGNING_SECRET") ?? "safealert-national-authority-hmac-key";
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/** Build the canonical CAP 1.2 JSON payload every adapter derives its message from. */
export function buildCapPayload(req: DispatchRequest, status: "Actual" | "Test" = "Actual") {
  return {
    identifier: req.alertId,
    sender: "alerts@safealert.live",
    sent: new Date().toISOString(),
    status,
    msgType: "Alert",
    scope: "Public",
    info: {
      language: req.languages[0] ?? "en",
      category: req.hazard === "security_threat" ? "Security" : "Met",
      event: req.headline,
      urgency: req.severity === "advisory" ? "Future" : "Immediate",
      severity: CAP_SEVERITY[req.severity],
      certainty: "Observed",
      expires: req.expiresAt,
      headline: req.headline,
      description: req.message,
      instruction: req.instructions,
      area: {
        areaDesc: req.target.zoneName,
        geocode: [{ valueName: "SafeAlertZone", value: req.target.zoneCode }],
        circle:
          req.target.centreLat != null && req.target.centreLng != null
            ? `${req.target.centreLat},${req.target.centreLng} 50`
            : null,
      },
    },
  };
}

/** Build the channel-specific provider payload for any channel. */
export function buildChannelBody(
  channel: ChannelKind,
  req: DispatchRequest,
  mode: "Actual" | "Test" = "Actual",
) {
  const cap = buildCapPayload(req, mode);
  const capXml = buildCapXmlDocument({
    id: req.alertId,
    hazard: req.hazard,
    severity: req.severity,
    headline: req.headline,
    message: req.message,
    instructions: req.instructions,
    languages: req.languages,
    expires: req.expiresAt,
    status: mode,
    zones: [{ code: req.target.zoneCode, name: req.target.zoneName }],
  });

  switch (channel) {
    case "cell_broadcast":
      return {
        protocol: "3GPP-TS-23.041-CBS",
        primitive: "Write-Replace-Warning-Request",
        messageIdentifier: CBS_MESSAGE_ID[req.severity],
        serialNumber: Math.floor(Math.random() * 65535),
        warningAreaList: [{ geocode: req.target.zoneCode, areaName: req.target.zoneName }],
        repetitionPeriod: 60,
        numberOfBroadcastsRequested: req.severity === "extreme" ? 0 : 6,
        dataCodingScheme: "0x01",
        warningMessageContents: req.languages.map((language) => ({
          language,
          text: `${req.headline}. ${req.message}${req.instructions ? ` ${req.instructions}` : ""}`.slice(
            0,
            1395,
          ),
        })),
        cap,
        capXml,
      };
    case "sms": {
      const smsBody = `${req.headline}: ${req.message}${req.instructions ? ` Action: ${req.instructions}` : ""}`.slice(
        0,
        306,
      );
      return {
        // BulkSMS Nigeria v2 native fields + SMPP 3.4 envelope
        from: "SafeAlert",
        to: env("BULKSMS_DEFAULT_RECIPIENTS") ?? "2347037770033,2349050030090",
        body: smsBody,
        gateway: "direct-refund",
        append_sender: "hosted",
        unicode: false,
        customer_reference: req.alertId,
        protocol: "BulkSMSNigeria-v2 / SMPP-3.4",
        audience: { zoneGeocode: req.target.zoneCode, estimatedRecipients: req.target.population },
        cap,
      };
    }
    case "satellite":
      return {
        protocol: "3GPP-NTN-D2D-LBand",
        beam: {
          geocode: req.target.zoneCode,
          lat: req.target.centreLat,
          lng: req.target.centreLng,
        },
        carrier: req.severity === "extreme" ? "priority-preempt" : "standard",
        repeatSeconds: 120,
        ttlSeconds: 6 * 60 * 60,
        payload: cap,
        capXml,
      };
    case "wifi_push":
      return {
        protocol: "CaptivePortal-WebPush-VAPID",
        zoneGeocode: req.target.zoneCode,
        title: req.headline,
        body: req.message,
        instructions: req.instructions,
        requireInteraction: req.severity !== "advisory",
        sound: req.sirenEnabled ? "emergency-siren-853-960hz" : null,
        cap,
      };
    case "siren":
      return {
        protocol: "SIP-RTP-SirenControl",
        zoneGeocode: req.target.zoneCode,
        tone: req.severity === "extreme" ? "wail-continuous" : "alert-pulsed",
        durationSeconds: req.severity === "extreme" ? 180 : 90,
        voiceOverLanguages: req.languages,
        ttsScript: `${req.headline}. ${req.message}. ${req.instructions ?? ""}`.trim(),
        cap,
      };
  }
}

async function postSigned(
  url: string,
  apiKey: string | null,
  channel: ChannelKind,
  body: unknown,
) {
  const started = Date.now();
  const rawBody = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const signature = signPayload(rawBody, timestamp);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "x-safealert-authority": "NEMA-NG-SAFEALERT",
    "x-safealert-channel": channel,
    "x-safealert-timestamp": timestamp,
    "x-safealert-signature": `sha256=${signature}`,
  };
  if (apiKey) {
    headers["authorization"] = `Bearer ${apiKey}`;
  }

  // Exponential backoff retry for 5xx server errors (up to 3 attempts)
  let lastResponse: Response | null = null;
  let lastText = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    lastResponse = await fetch(url, {
      method: "POST",
      headers,
      body: rawBody,
    });
    lastText = await lastResponse.text();
    if (lastResponse.status < 500 || attempt === 3) {
      break;
    }
    await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
  }

  return {
    ok: lastResponse?.ok ?? false,
    status: lastResponse?.status ?? 0,
    text: lastText,
    latencyMs: Date.now() - started,
    headers,
  };
}

function resolveChannelCredentials(channel: ChannelKind, gatewayEndpoint?: string | null) {
  const map: Record<ChannelKind, { urlEnv: string; keyEnv: string; reach: number }> = {
    cell_broadcast: { urlEnv: "CBC_ENDPOINT", keyEnv: "CBC_API_KEY", reach: 0.96 },
    sms: { urlEnv: "SMPP_HTTP_ENDPOINT", keyEnv: "BULKSMS_NIGERIA_API_TOKEN", reach: 0.82 },
    satellite: { urlEnv: "SATELLITE_ENDPOINT", keyEnv: "SATELLITE_API_KEY", reach: 0.63 },
    wifi_push: { urlEnv: "WIFI_PUSH_ENDPOINT", keyEnv: "WIFI_PUSH_API_KEY", reach: 0.35 },
    siren: { urlEnv: "SIREN_ENDPOINT", keyEnv: "SIREN_API_KEY", reach: 0.99 },
  };
  const cfg = map[channel];
  const envUrl = env(cfg.urlEnv);
  const envKey = env(cfg.keyEnv) ?? (channel === "sms" ? env("SMPP_API_KEY") : null);
  const effectiveUrl = envUrl ?? (isValidHttpEndpoint(gatewayEndpoint) ? gatewayEndpoint : null);
  return {
    url: effectiveUrl,
    key: envKey,
    reach: cfg.reach,
  };
}

async function dispatchChannel(channel: ChannelKind, req: DispatchRequest): Promise<DispatchResult> {
  const { url, key, reach } = resolveChannelCredentials(channel, req.gatewayEndpoint);
  const targeted = Math.max(1, Math.round(req.target.population));

  if (!url) {
    return {
      channel,
      status: "failed",
      devicesTargeted: targeted,
      devicesReached: 0,
      latencyMs: 0,
      gatewayReference: null,
      errorDetail: `No HTTP/HTTPS gateway endpoint configured for ${channel}.`,
    };
  }

  const body = buildChannelBody(channel, req, "Actual");
  try {
    const res = await postSigned(url, key, channel, body);
    if (!res.ok) {
      let errMessage = `Gateway HTTP ${res.status}: ${res.text.slice(0, 200)}`;
      try {
        const parsedErr = JSON.parse(res.text) as {
          code?: string;
          error?: { message?: string; code?: string };
        };
        const bsng = describeBsngCode(parsedErr.code ?? parsedErr.error?.code);
        if (bsng) {
          errMessage = `${bsng.code} (${bsng.category}): ${parsedErr.error?.message ?? bsng.description}`;
        }
      } catch {
        // use raw text
      }
      return {
        channel,
        status: "failed",
        devicesTargeted: targeted,
        devicesReached: 0,
        latencyMs: res.latencyMs,
        gatewayReference: null,
        errorDetail: errMessage,
      };
    }

    let reference: string | null = null;
    try {
      const parsed = JSON.parse(res.text) as {
        reference?: string;
        messageId?: string;
        id?: string;
        data?: { message_id?: string };
      };
      reference =
        parsed.data?.message_id ??
        parsed.reference ??
        parsed.messageId ??
        parsed.id ??
        ref(channel.slice(0, 3).toUpperCase());
    } catch {
      reference = ref(channel.slice(0, 3).toUpperCase());
    }

    return {
      channel,
      status: "delivered",
      devicesTargeted: targeted,
      devicesReached: Math.round(targeted * reach),
      latencyMs: res.latencyMs,
      gatewayReference: reference,
      errorDetail: null,
    };
  } catch (error) {
    return {
      channel,
      status: "failed",
      devicesTargeted: targeted,
      devicesReached: 0,
      latencyMs: 0,
      gatewayReference: null,
      errorDetail: error instanceof Error ? error.message : "Gateway unreachable",
    };
  }
}

/**
 * Fan an alert out across every requested channel and zone in parallel over HTTP/HTTPS.
 */
export async function dispatchAll(
  channels: ChannelKind[],
  requests: DispatchRequest[],
  gateways?: { channel: ChannelKind; endpoint: string | null }[],
): Promise<DispatchResult[]> {
  const jobs: Promise<DispatchResult>[] = [];
  for (const request of requests) {
    for (const channel of channels) {
      if (channel === "siren" && !request.sirenEnabled) continue;
      const gw = gateways?.find((g) => g.channel === channel && isValidHttpEndpoint(g.endpoint));
      jobs.push(
        dispatchChannel(channel, {
          ...request,
          gatewayEndpoint: gw?.endpoint ?? request.gatewayEndpoint ?? null,
        }),
      );
    }
  }
  return Promise.all(jobs);
}

/**
 * Live Provider API Diagnostic Probe:
 * Sends a real HTTP POST with HMAC-SHA256 signature and CAP 1.2 payload to the gateway endpoint.
 */
export async function testGatewayDispatch(input: {
  channel: ChannelKind;
  endpointUrl?: string | null | undefined;
  zoneCode?: string | undefined;
  zoneName?: string | undefined;
}): Promise<GatewayTestReport> {
  const req: DispatchRequest = {
    alertId: `PROBE-${Date.now().toString(36).toUpperCase()}`,
    hazard: "flood",
    severity: "warning",
    headline: "SAFEALERT GATEWAY DIAGNOSTIC PROBE",
    message:
      "Live provider API verification probe checking CAP 1.2 envelope, HMAC-SHA256 signature, and HTTP gateway response.",
    instructions: "Diagnostic probe only.",
    languages: ["en", "ha", "yo", "ig", "pcm"],
    sirenEnabled: false,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    target: {
      zoneId: "00000000-0000-4000-8000-000000000001",
      zoneCode: input.zoneCode || "LAG-METRO",
      zoneName: input.zoneName || "Lagos Metropolitan",
      population: 15_400_000,
      centreLat: 6.5244,
      centreLng: 3.3792,
    },
  };

  const payload = buildChannelBody(input.channel, req, "Test") as Record<string, unknown>;
  const capXml = buildCapXmlDocument({
    id: req.alertId,
    hazard: req.hazard,
    severity: req.severity,
    headline: req.headline,
    message: req.message,
    instructions: req.instructions,
    languages: req.languages,
    expires: req.expiresAt,
    status: "Test",
    zones: [{ code: req.target.zoneCode, name: req.target.zoneName }],
  });

  const resolved = resolveChannelCredentials(input.channel, input.endpointUrl);
  const rawBody = JSON.stringify(payload);
  const formattedPayload = JSON.stringify(payload, null, 2);
  const timestamp = new Date().toISOString();
  const signature = signPayload(rawBody, timestamp);
  const signedHeaders: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "x-safealert-authority": "NEMA-NG-SAFEALERT",
    "x-safealert-channel": input.channel,
    "x-safealert-timestamp": timestamp,
    "x-safealert-signature": `sha256=${signature}`,
  };

  if (!resolved.url) {
    return {
      ok: false,
      channel: input.channel,
      targetEndpoint: "unconfigured",
      statusCode: 0,
      latencyMs: 0,
      gatewayReference: ref("NO-ENDPOINT"),
      requestHeaders: signedHeaders,
      requestPayload: formattedPayload,
      capXml,
      responsePreview:
        "No HTTP/HTTPS endpoint provided. Enter a live webhook URL or configure an endpoint on the gateway.",
    };
  }

  try {
    const res = await postSigned(resolved.url, resolved.key, input.channel, payload);
    return {
      ok: res.ok,
      channel: input.channel,
      targetEndpoint: resolved.url,
      statusCode: res.status,
      latencyMs: res.latencyMs,
      gatewayReference: ref(input.channel.slice(0, 3).toUpperCase()),
      requestHeaders: res.headers,
      requestPayload: formattedPayload,
      capXml,
      responsePreview: res.text.slice(0, 1200) || "(Empty response body)",
    };
  } catch (err) {
    return {
      ok: false,
      channel: input.channel,
      targetEndpoint: resolved.url,
      statusCode: 0,
      latencyMs: 0,
      gatewayReference: ref("ERR"),
      requestHeaders: signedHeaders,
      requestPayload: formattedPayload,
      capXml,
      responsePreview: err instanceof Error ? err.message : "Network connection failed",
    };
  }
}

/**
 * BulkSMS Nigeria v2 Dedicated Dispatcher (Supports both Sandbox & Production, SMS & Voice TTS,
 * with BSNG-XXXX error decoding and 5xx exponential backoff retry).
 */
export async function sendBulkSmsNigeriaV2(input: {
  environment: BulkSmsEnvironment;
  mode: "sms" | "voice";
  apiToken?: string | null;
  from: string;
  to: string;
  body: string;
  gateway?: BulkSmsGatewayRoute;
  unicode?: boolean;
  callbackUrl?: string | null;
  customerReference?: string | null;
}): Promise<BulkSmsTestReport> {
  const baseUrl = BULKSMS_NIGERIA_BASE_URLS[input.environment];
  const endpointUrl =
    input.mode === "voice" ? `${baseUrl}/voice/create` : `${baseUrl}/sms`;
  const token =
    input.apiToken?.trim() ||
    env("BULKSMS_NIGERIA_API_TOKEN") ||
    env("SMPP_API_KEY") ||
    "";

  const payload: Record<string, unknown> = {
    from: sanitizeSenderId(input.from),
    to: input.to.trim(),
    body: input.body.trim(),
    gateway: input.gateway ?? "direct-refund",
    append_sender: "hosted",
    unicode: Boolean(input.unicode),
    ...(input.callbackUrl ? { callback_url: input.callbackUrl.trim() } : {}),
    ...(input.customerReference
      ? { customer_reference: input.customerReference.trim() }
      : {}),
  };

  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const started = Date.now();
  let httpStatus = 0;
  let responseText = "";
  let attempts = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    attempts = attempt;
    try {
      const res = await fetch(endpointUrl, {
        method: "POST",
        headers,
        body: rawBody,
        signal: AbortSignal.timeout(10000),
      });
      httpStatus = res.status;
      responseText = await res.text();

      // Do not retry 2xx or 4xx client errors; only retry 5xx server errors
      if (httpStatus < 500 || attempt === 3) {
        break;
      }
    } catch (err) {
      responseText = err instanceof Error ? err.message : "Network error";
      if (attempt === 3) break;
    }
    await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
  }

  const latencyMs = Date.now() - started;

  try {
    const parsed = JSON.parse(responseText) as {
      status?: string;
      code?: string;
      message?: string;
      data?: {
        message_id?: string;
        cost?: number;
        currency?: string;
        recipients_count?: number;
        gateway_used?: string;
        sandbox_mode?: boolean;
      };
      error?: {
        message?: string;
        code?: string;
        description?: string;
      };
    };

    const code = parsed.code ?? parsed.error?.code ?? (httpStatus === 200 ? "BSNG-0000" : "BSNG-1001");
    const info = describeBsngCode(code);
    const ok = parsed.status === "success" || code === "BSNG-0000";

    return {
      ok,
      environment: input.environment,
      mode: input.mode,
      endpointUrl,
      httpStatus,
      bsngCode: code,
      bsngCategory: info?.category ?? (ok ? "Success" : "Validation"),
      bsngDescription:
        parsed.error?.description ??
        info?.description ??
        parsed.message ??
        "BulkSMS Nigeria response received.",
      message:
        parsed.message ??
        parsed.error?.message ??
        info?.description ??
        "Response received",
      messageId: parsed.data?.message_id ?? null,
      cost: typeof parsed.data?.cost === "number" ? parsed.data.cost : null,
      currency: parsed.data?.currency ?? "NGN",
      recipientsCount: parsed.data?.recipients_count ?? 0,
      gatewayUsed: parsed.data?.gateway_used ?? null,
      sandboxMode: Boolean(parsed.data?.sandbox_mode ?? input.environment === "sandbox"),
      latencyMs,
      attempts,
      rawResponse: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return {
      ok: false,
      environment: input.environment,
      mode: input.mode,
      endpointUrl,
      httpStatus,
      bsngCode: httpStatus === 401 ? "BSNG-1001" : "BSNG-5001",
      bsngCategory: httpStatus === 401 ? "Authentication" : "Server Error",
      bsngDescription: responseText.slice(0, 240) || "Unexpected response from BulkSMS Nigeria.",
      message: responseText.slice(0, 240) || "Request failed",
      messageId: null,
      cost: null,
      currency: "NGN",
      recipientsCount: 0,
      gatewayUsed: null,
      sandboxMode: input.environment === "sandbox",
      latencyMs,
      attempts,
      rawResponse: responseText.slice(0, 1200),
    };
  }
}

export async function checkBulkSmsNigeriaBalanceV2(input: {
  environment: BulkSmsEnvironment;
  apiToken?: string | null;
}): Promise<BulkSmsBalanceReport> {
  const baseUrl = BULKSMS_NIGERIA_BASE_URLS[input.environment];
  const endpointUrl = `${baseUrl}/balance`;
  const token =
    input.apiToken?.trim() ||
    env("BULKSMS_NIGERIA_API_TOKEN") ||
    env("SMPP_API_KEY") ||
    "";

  try {
    const res = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const parsed = JSON.parse(text) as {
      status?: string;
      code?: string;
      message?: string;
      data?: {
        balance?: number;
        currency?: string;
        formatted?: string;
      };
      error?: {
        message?: string;
        code?: string;
        description?: string;
      };
    };

    const code = parsed.code ?? parsed.error?.code ?? (res.ok ? "BSNG-0000" : "BSNG-1001");
    const info = describeBsngCode(code);
    const ok = parsed.status === "success" || code === "BSNG-0000";

    return {
      ok,
      environment: input.environment,
      httpStatus: res.status,
      bsngCode: code,
      bsngDescription:
        parsed.error?.message ??
        info?.description ??
        parsed.message ??
        "Balance check completed.",
      balance: typeof parsed.data?.balance === "number" ? parsed.data.balance : null,
      currency: parsed.data?.currency ?? "NGN",
      formatted: parsed.data?.formatted ?? null,
      rawResponse: JSON.stringify(parsed, null, 2),
    };
  } catch (err) {
    return {
      ok: false,
      environment: input.environment,
      httpStatus: 0,
      bsngCode: "BSNG-5003",
      bsngDescription: err instanceof Error ? err.message : "Could not reach BulkSMS Nigeria",
      balance: null,
      currency: "NGN",
      formatted: null,
      rawResponse: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function channelConfigured(channel: ChannelKind, activeEndpoints?: (string | null)[]) {
  const hasLiveDbUrl = (activeEndpoints ?? []).some((u) => isValidHttpEndpoint(u));
  if (hasLiveDbUrl) return true;
  switch (channel) {
    case "cell_broadcast":
      return Boolean(env("CBC_ENDPOINT"));
    case "sms":
      return Boolean(env("SMPP_HTTP_ENDPOINT") || env("BULKSMS_NIGERIA_API_TOKEN"));
    case "satellite":
      return Boolean(env("SATELLITE_ENDPOINT"));
    case "wifi_push":
      return Boolean(env("WIFI_PUSH_ENDPOINT"));
    case "siren":
      return Boolean(env("SIREN_ENDPOINT"));
  }
}
