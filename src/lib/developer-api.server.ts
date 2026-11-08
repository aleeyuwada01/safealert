import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fetchLiveIntelligenceHandler } from "./live-intel.server";

function getDb() {
  const url =
    process.env["VITE_SUPABASE_URL"] ||
    "https://mnwbcvehgraxewecwrfq.supabase.co";
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    "sb_publishable_YeLqAJsJPW3F9fODvFYoHA_D59vPyyl";
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface DeveloperApiKeyRow {
  id: string;
  user_id: string | null;
  name: string;
  organization: string;
  environment: "live" | "test";
  key_prefix: string;
  api_key: string;
  scopes: string[];
  rate_limit_per_min: number;
  requests_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DeveloperWebhookRow {
  id: string;
  user_id: string | null;
  name: string;
  target_url: string;
  signing_secret: string;
  events: string[];
  zone_codes: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  created_at: string;
}

export async function getDeveloperWorkspaceHandler() {
  const db = getDb();
  const [keysRes, webhooksRes, zonesRes] = await Promise.all([
    db.from("developer_api_keys").select("*").order("created_at", { ascending: false }),
    db.from("developer_webhooks").select("*").order("created_at", { ascending: false }),
    db.from("zones").select("code, name, region, population_estimate").order("code"),
  ]);

  return {
    apiKeys: (keysRes.data ?? []) as DeveloperApiKeyRow[],
    webhooks: (webhooksRes.data ?? []) as DeveloperWebhookRow[],
    zones: (zonesRes.data ?? []) as Array<{
      code: string;
      name: string;
      region: string | null;
      population_estimate: number;
    }>,
  };
}

export async function createDeveloperApiKeyHandler(input: {
  userId?: string | null | undefined;
  name: string;
  organization: string;
  environment: "live" | "test";
  scopes: string[];
  rateLimitPerMin?: number | undefined;
}) {
  const db = getDb();
  const slug = input.organization
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6) || "partner";
  const rand = randomBytes(16).toString("hex");
  const fullKey = `sa_${input.environment}_${slug}_${rand}`;
  const prefix = `${fullKey.slice(0, 16)}...`;

  const { data, error } = await db
    .from("developer_api_keys")
    .insert({
      user_id: input.userId || null,
      name: input.name.trim(),
      organization: input.organization.trim(),
      environment: input.environment,
      key_prefix: prefix,
      api_key: fullKey,
      scopes: input.scopes,
      rate_limit_per_min: input.rateLimitPerMin ?? (input.environment === "live" ? 600 : 120),
      requests_count: 0,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as DeveloperApiKeyRow;
}

export async function toggleDeveloperApiKeyHandler(input: { id: string; is_active: boolean }) {
  const db = getDb();
  const { error } = await db
    .from("developer_api_keys")
    .update({ is_active: input.is_active })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteDeveloperApiKeyHandler(input: { id: string }) {
  const db = getDb();
  const { error } = await db.from("developer_api_keys").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function createDeveloperWebhookHandler(input: {
  userId?: string | null | undefined;
  name: string;
  targetUrl: string;
  events: string[];
  zoneCodes: string[];
}) {
  const db = getDb();
  const secret = `whsec_sa_${randomBytes(16).toString("hex")}`;
  const { data, error } = await db
    .from("developer_webhooks")
    .insert({
      user_id: input.userId || null,
      name: input.name.trim(),
      target_url: input.targetUrl.trim(),
      signing_secret: secret,
      events: input.events,
      zone_codes: input.zoneCodes,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as DeveloperWebhookRow;
}

export async function deleteDeveloperWebhookHandler(input: { id: string }) {
  const db = getDb();
  const { error } = await db.from("developer_webhooks").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function triggerDeveloperWebhookTestHandler(input: { webhookId: string }) {
  const db = getDb();
  const { data: wh, error } = await db
    .from("developer_webhooks")
    .select("*")
    .eq("id", input.webhookId)
    .single();

  if (error || !wh) throw new Error("Webhook subscription not found.");
  const webhook = wh as DeveloperWebhookRow;

  const timestamp = new Date().toISOString();
  const payload = {
    event: "alert.live",
    webhook_id: webhook.id,
    delivered_at: timestamp,
    authority: "NEMA-NG-SAFEALERT",
    data: {
      alert_id: "eb01a622-2026-4000-8000-000000000622",
      hazard: "epidemic",
      severity: "extreme",
      status: "live",
      headline: "WHO & NCDC Ebola Virus Surveillance Alert — Nigeria",
      zones: webhook.zone_codes,
      instructions:
        "Report sudden high fever or unexplained bleeding to NCDC Toll-Free 6232 immediately.",
    },
  };
  const bodyStr = JSON.stringify(payload);
  const sig =
    "sha256=" +
    createHmac("sha256", webhook.signing_secret)
      .update(`${timestamp}.${bodyStr}`)
      .digest("hex");

  const start = Date.now();
  let statusCode = 0;
  let responseBody = "";
  let ok = false;

  try {
    const res = await fetch(webhook.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SafeAlert-Webhook-Dispatcher/2.0",
        "X-SafeAlert-Event": "alert.live",
        "X-SafeAlert-Timestamp": timestamp,
        "X-SafeAlert-Signature": sig,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(10000),
    });
    statusCode = res.status;
    ok = res.ok;
    responseBody = (await res.text()).slice(0, 500);
  } catch (err) {
    statusCode = 502;
    responseBody = err instanceof Error ? err.message : String(err);
  }

  const latencyMs = Date.now() - start;
  await db
    .from("developer_webhooks")
    .update({
      last_triggered_at: timestamp,
      last_status_code: statusCode,
    })
    .eq("id", webhook.id);

  return {
    ok,
    statusCode,
    latencyMs,
    signature: sig,
    targetUrl: webhook.target_url,
    requestPayload: payload,
    responseBody,
  };
}

/**
 * Evaluates a public API v1 request (used by both the real HTTP /api/v1/* handler
 * and the interactive Developer Portal Playground).
 */
export async function executePublicApiV1Request(input: {
  apiKey: string;
  endpoint: "/api/v1/alerts" | "/api/v1/intelligence" | "/api/v1/zones" | "/api/v1/status";
  zoneFilter?: string | null | undefined;
  severityFilter?: string | null | undefined;
}) {
  const start = Date.now();
  const db = getDb();
  const cleanKey = input.apiKey.trim().replace(/^Bearer\s+/i, "");

  if (!cleanKey) {
    return {
      httpStatus: 401,
      latencyMs: Date.now() - start,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="SafeAlert Public API v1"',
      },
      body: {
        status: "error",
        code: "SA-4001",
        error: "Missing API key. Pass Authorization: Bearer sa_live_... or ?api_key=sa_live_...",
      },
    };
  }

  const { data: keyRow } = await db
    .from("developer_api_keys")
    .select("*")
    .eq("api_key", cleanKey)
    .maybeSingle();

  if (!keyRow || !keyRow.is_active) {
    return {
      httpStatus: 403,
      latencyMs: Date.now() - start,
      headers: { "Content-Type": "application/json" },
      body: {
        status: "error",
        code: "SA-4003",
        error: "Invalid or revoked SafeAlert API key.",
      },
    };
  }

  const typedKey = keyRow as DeveloperApiKeyRow;
  // Increment usage count asynchronously
  await db
    .from("developer_api_keys")
    .update({
      requests_count: (typedKey.requests_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", typedKey.id);

  const responseHeaders = {
    "Content-Type": "application/json",
    "X-SafeAlert-API-Version": "2026-11-08.v1",
    "X-SafeAlert-Organization": typedKey.organization,
    "X-SafeAlert-Environment": typedKey.environment,
    "X-RateLimit-Limit": String(typedKey.rate_limit_per_min),
    "X-RateLimit-Remaining": String(Math.max(0, typedKey.rate_limit_per_min - 1)),
  };

  if (input.endpoint === "/api/v1/status") {
    return {
      httpStatus: 200,
      latencyMs: Date.now() - start,
      headers: responseHeaders,
      body: {
        status: "success",
        code: "SA-0000",
        key_metadata: {
          name: typedKey.name,
          organization: typedKey.organization,
          environment: typedKey.environment,
          key_prefix: typedKey.key_prefix,
          scopes: typedKey.scopes,
          rate_limit_per_min: typedKey.rate_limit_per_min,
          total_requests: (typedKey.requests_count ?? 0) + 1,
        },
        grid_status: "OPERATIONAL",
        standards: ["OASIS CAP 1.2", "3GPP TS 23.041 CBS", "WHO DON REST", "NCDC SitRep"],
      },
    };
  }

  if (input.endpoint === "/api/v1/zones") {
    const { data: zones } = await db
      .from("zones")
      .select("id, code, name, region, population_estimate, centre_lat, centre_lng")
      .order("code");
    return {
      httpStatus: 200,
      latencyMs: Date.now() - start,
      headers: responseHeaders,
      body: {
        status: "success",
        code: "SA-0000",
        count: (zones ?? []).length,
        data: zones ?? [],
      },
    };
  }

  if (input.endpoint === "/api/v1/intelligence") {
    const intel = await fetchLiveIntelligenceHandler();
    const filteredItems = input.zoneFilter && input.zoneFilter !== "ALL"
      ? intel.items.filter(
          (i) =>
            i.region.toUpperCase().includes(input.zoneFilter ?? "") ||
            i.isNigeriaFocused,
        )
      : intel.items;

    return {
      httpStatus: 200,
      latencyMs: Date.now() - start,
      headers: responseHeaders,
      body: {
        status: "success",
        code: "SA-0000",
        fetched_at: intel.fetchedAt,
        sources: intel.sourcesOnline,
        zone_weather: intel.zoneWeather,
        count: filteredItems.length,
        data: filteredItems,
      },
    };
  }

  // Default: /api/v1/alerts
  let query = db
    .from("alerts")
    .select(
      "id, hazard, severity, status, headline, message, instructions, languages, siren_enabled, issued_at, expires_at, alert_zones(zones(code, name, region))",
    )
    .in("status", ["live", "broadcasting"])
    .order("issued_at", { ascending: false });

  if (input.severityFilter && input.severityFilter !== "ALL") {
    query = query.eq("severity", input.severityFilter);
  }

  const { data: alerts } = await query;
  const formatted = (alerts ?? [])
    .map((a) => {
      const zList =
        (
          a.alert_zones as unknown as Array<{
            zones: { code: string; name: string; region: string | null } | null;
          }>
        )
          ?.map((az) => az.zones)
          .filter((z): z is { code: string; name: string; region: string | null } => Boolean(z)) ??
        [];
      return {
        id: a.id,
        hazard: a.hazard,
        severity: a.severity,
        status: a.status,
        headline: a.headline,
        message: a.message,
        instructions: a.instructions,
        languages: a.languages,
        siren_enabled: a.siren_enabled,
        issued_at: a.issued_at,
        expires_at: a.expires_at,
        zones: zList,
        cap_1_2_identifier: `urn:oasis:names:tc:emergency:cap:1.2:safealert:${a.id}`,
      };
    })
    .filter((a) => {
      if (!input.zoneFilter || input.zoneFilter === "ALL") return true;
      return a.zones.some((z) => z.code === input.zoneFilter);
    });

  return {
    httpStatus: 200,
    latencyMs: Date.now() - start,
    headers: responseHeaders,
    body: {
      status: "success",
      code: "SA-0000",
      environment: typedKey.environment,
      count: formatted.length,
      data: formatted,
    },
  };
}
