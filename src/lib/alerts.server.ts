/** Server-only alert issuance, approval, cancellation & gateway testing logic. */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ChannelKind, Hazard, Severity } from "./safealert";
import { CHANNELS } from "./safealert";
import {
  channelConfigured,
  checkBulkSmsNigeriaBalanceV2,
  dispatchAll,
  sendBulkSmsNigeriaV2,
  testGatewayDispatch,
  type DispatchRequest,
} from "./dispatch.server";
import {
  isBulkSmsDelivered,
  type BulkSmsEnvironment,
  type BulkSmsGatewayRoute,
} from "./bulksms-nigeria";

interface AuthContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

export interface IssueInput {
  hazard: Hazard;
  severity: Severity;
  headline: string;
  message: string;
  instructions?: string | null | undefined;
  languages: string[];
  sirenEnabled: boolean;
  zoneIds: string[];
  channels: ChannelKind[];
  expiresInHours: number;
  evacuationMapUrl?: string | null | undefined;
  requireApproval?: boolean | undefined;
}

async function assertCanIssue(supabase: SupabaseClient<Database>, userId: string) {
  const { data: allowed, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleError) throw new Error(roleError.message);
  const roles = (allowed ?? []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("operator")) {
    throw new Error("Your account does not have permission to issue or approve alerts.");
  }
  return roles;
}

export async function issueAlertHandler(input: IssueInput, context: AuthContext) {
  const { supabase, userId } = context;
  await assertCanIssue(supabase, userId);

  const { data: zones, error: zoneError } = await supabase
    .from("zones")
    .select("id, code, name, population_estimate, centre_lat, centre_lng")
    .in("id", input.zoneIds);
  if (zoneError) throw new Error(zoneError.message);
  if (!zones || zones.length === 0) throw new Error("Select at least one valid coverage zone.");

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + input.expiresInHours * 3_600_000).toISOString();
  const initialStatus = input.requireApproval ? "pending_approval" : "broadcasting";

  const { data: alert, error: insertError } = await supabase
    .from("alerts")
    .insert({
      hazard: input.hazard,
      severity: input.severity,
      status: initialStatus,
      headline: input.headline,
      message: input.message,
      instructions: input.instructions ?? null,
      languages: input.languages,
      siren_enabled: input.sirenEnabled,
      evacuation_map_url: input.evacuationMapUrl ?? null,
      issued_at: nowIso,
      effective_at: nowIso,
      expires_at: expiresAt,
      created_by: userId,
    })
    .select("id")
    .single();
  if (insertError || !alert) throw new Error(insertError?.message ?? "Could not create the alert.");

  const { error: zoneLinkError } = await supabase
    .from("alert_zones")
    .insert(zones.map((zone) => ({ alert_id: alert.id, zone_id: zone.id })));
  if (zoneLinkError) throw new Error(zoneLinkError.message);

  if (input.requireApproval) {
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "alert.submitted_for_approval",
      alert_id: alert.id,
      detail: {
        channels: input.channels,
        zones: zones.map((z) => z.code),
      },
    });

    const totalPop = zones.reduce((s, z) => s + Number(z.population_estimate ?? 0), 0);
    return {
      alertId: alert.id,
      status: "pending_approval" as const,
      reached: 0,
      targeted: totalPop,
      results: [],
    };
  }

  const { data: gateways } = await supabase
    .from("channel_gateways")
    .select("id, channel, endpoint")
    .eq("is_active", true);

  const requests: DispatchRequest[] = zones.map((zone) => ({
    alertId: alert.id,
    hazard: input.hazard,
    severity: input.severity,
    headline: input.headline,
    message: input.message,
    instructions: input.instructions ?? null,
    languages: input.languages,
    sirenEnabled: input.sirenEnabled,
    expiresAt,
    target: {
      zoneId: zone.id,
      zoneCode: zone.code,
      zoneName: zone.name,
      population: Number(zone.population_estimate ?? 0),
      centreLat: zone.centre_lat,
      centreLng: zone.centre_lng,
    },
  }));

  const results = await dispatchAll(input.channels, requests, gateways ?? []);

  const rows = results.map((result, index) => {
    const request = requests[Math.floor(index / Math.max(1, results.length / requests.length))];
    const gateway = (gateways ?? []).find((g) => g.channel === result.channel);
    return {
      alert_id: alert.id,
      zone_id: request?.target.zoneId ?? null,
      gateway_id: gateway?.id ?? null,
      channel: result.channel,
      status: result.status,
      devices_targeted: result.devicesTargeted,
      devices_reached: result.devicesReached,
      latency_ms: result.latencyMs,
      gateway_reference: result.gatewayReference,
      error_detail: result.errorDetail,
    };
  });

  const { error: deliveryError } = await supabase.from("alert_deliveries").insert(rows);
  if (deliveryError) throw new Error(deliveryError.message);

  const anyDelivered = results.some((r) => r.status !== "failed");
  await supabase
    .from("alerts")
    .update({ status: anyDelivered ? "live" : "draft" })
    .eq("id", alert.id);

  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "alert.issued",
    alert_id: alert.id,
    detail: {
      channels: input.channels,
      zones: zones.map((z) => z.code),
    },
  });

  return {
    alertId: alert.id,
    status: anyDelivered ? ("live" as const) : ("failed" as const),
    reached: results.reduce((sum, r) => sum + r.devicesReached, 0),
    targeted: results.reduce((sum, r) => sum + r.devicesTargeted, 0),
    results: results.map((r) => ({
      channel: r.channel,
      status: r.status,
      devicesReached: r.devicesReached,
      latencyMs: r.latencyMs,
      gatewayReference: r.gatewayReference,
      errorDetail: r.errorDetail,
    })),
  };
}

export async function approveAlertHandler(alertId: string, context: AuthContext) {
  const { supabase, userId } = context;
  await assertCanIssue(supabase, userId);

  const { data: alert, error: alertErr } = await supabase
    .from("alerts")
    .select(
      "id, hazard, severity, status, headline, message, instructions, languages, siren_enabled, expires_at, alert_zones(zone_id)",
    )
    .eq("id", alertId)
    .single();
  if (alertErr || !alert) throw new Error(alertErr?.message ?? "Alert not found.");

  const zoneIds = (alert.alert_zones ?? []).map((az) => az.zone_id);
  const { data: zones } = await supabase
    .from("zones")
    .select("id, code, name, population_estimate, centre_lat, centre_lng")
    .in("id", zoneIds.length > 0 ? zoneIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: gateways } = await supabase
    .from("channel_gateways")
    .select("id, channel, endpoint")
    .eq("is_active", true);

  const channels: ChannelKind[] = [
    "cell_broadcast",
    "sms",
    "satellite",
    "wifi_push",
    ...(alert.siren_enabled ? (["siren"] as ChannelKind[]) : []),
  ];

  const requests: DispatchRequest[] = (zones ?? []).map((zone) => ({
    alertId: alert.id,
    hazard: alert.hazard,
    severity: alert.severity,
    headline: alert.headline,
    message: alert.message,
    instructions: alert.instructions,
    languages: alert.languages,
    sirenEnabled: alert.siren_enabled,
    expiresAt: alert.expires_at,
    target: {
      zoneId: zone.id,
      zoneCode: zone.code,
      zoneName: zone.name,
      population: Number(zone.population_estimate ?? 0),
      centreLat: zone.centre_lat,
      centreLng: zone.centre_lng,
    },
  }));

  const results = await dispatchAll(channels, requests, gateways ?? []);
  const rows = results.map((result, index) => {
    const request = requests[Math.floor(index / Math.max(1, results.length / requests.length))];
    const gateway = (gateways ?? []).find((g) => g.channel === result.channel);
    return {
      alert_id: alert.id,
      zone_id: request?.target.zoneId ?? null,
      gateway_id: gateway?.id ?? null,
      channel: result.channel,
      status: result.status,
      devices_targeted: result.devicesTargeted,
      devices_reached: result.devicesReached,
      latency_ms: result.latencyMs,
      gateway_reference: result.gatewayReference,
      error_detail: result.errorDetail,
    };
  });

  if (rows.length > 0) {
    await supabase.from("alert_deliveries").insert(rows);
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("alerts")
    .update({
      status: "live",
      approved_by: userId,
      approved_at: nowIso,
      issued_at: nowIso,
    })
    .eq("id", alertId);

  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "alert.approved_and_broadcast",
    alert_id: alertId,
    detail: {
      channels,
      dispatches: rows.length,
    },
  });

  return { ok: true, reached: results.reduce((s, r) => s + r.devicesReached, 0) };
}

export async function cancelAlertHandler(alertId: string, context: AuthContext) {
  const { supabase, userId } = context;
  await assertCanIssue(supabase, userId);
  const { error } = await supabase
    .from("alerts")
    .update({ status: "cancelled" })
    .eq("id", alertId);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "alert.cancelled",
    alert_id: alertId,
    detail: {},
  });
  return { ok: true };
}

export async function testGatewayHandler(
  input: {
    gatewayId?: string | null | undefined;
    channel: ChannelKind;
    endpointUrl?: string | null | undefined;
    zoneCode?: string | undefined;
    zoneName?: string | undefined;
  },
  context: AuthContext,
) {
  const { supabase, userId } = context;
  await assertCanIssue(supabase, userId);

  let targetUrl = input.endpointUrl;
  if (!targetUrl && input.gatewayId) {
    const { data: gw } = await supabase
      .from("channel_gateways")
      .select("endpoint")
      .eq("id", input.gatewayId)
      .single();
    targetUrl = gw?.endpoint ?? null;
  }
  if (!targetUrl) {
    const { data: activeGw } = await supabase
      .from("channel_gateways")
      .select("endpoint")
      .eq("channel", input.channel)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    targetUrl = activeGw?.endpoint ?? null;
  }

  const report = await testGatewayDispatch({
    channel: input.channel,
    endpointUrl: targetUrl,
    zoneCode: input.zoneCode,
    zoneName: input.zoneName,
  });

  if (input.gatewayId) {
    await supabase
      .from("channel_gateways")
      .update({
        last_heartbeat_at: new Date().toISOString(),
        health: report.ok ? "healthy" : "degraded",
      })
      .eq("id", input.gatewayId);
  }

  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "gateway.live_probe",
    detail: {
      gatewayId: input.gatewayId ?? null,
      channel: input.channel,
      endpoint: report.targetEndpoint,
      statusCode: report.statusCode,
      latencyMs: report.latencyMs,
      ok: report.ok,
    },
  });

  return report;
}

export function channelStatusHandler() {
  return {
    channels: CHANNELS.map((channel) => ({
      channel: channel.value,
      label: channel.label,
      transport: channel.transport,
      protocol: channel.protocol,
      configuredViaEnv: channelConfigured(channel.value),
    })),
  };
}

export async function testBulkSmsNigeriaHandler(
  input: {
    environment: BulkSmsEnvironment;
    mode: "sms" | "voice";
    apiToken?: string | null | undefined;
    from: string;
    to: string;
    body: string;
    gateway?: BulkSmsGatewayRoute | undefined;
    unicode?: boolean | undefined;
    callbackUrl?: string | null | undefined;
    customerReference?: string | null | undefined;
  },
  context: AuthContext,
) {
  const { supabase, userId } = context;
  await assertCanIssue(supabase, userId);

  const report = await sendBulkSmsNigeriaV2({
    environment: input.environment,
    mode: input.mode,
    apiToken: input.apiToken ?? null,
    from: input.from,
    to: input.to,
    body: input.body,
    ...(input.gateway ? { gateway: input.gateway } : {}),
    ...(input.unicode !== undefined ? { unicode: input.unicode } : {}),
    callbackUrl: input.callbackUrl ?? null,
    customerReference: input.customerReference ?? null,
  });

  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: `bulksms_nigeria.${input.environment}_${input.mode}`,
    detail: {
      endpoint: report.endpointUrl,
      bsngCode: report.bsngCode,
      httpStatus: report.httpStatus,
      messageId: report.messageId,
      sandboxMode: report.sandboxMode,
      ok: report.ok,
    },
  });

  return report;
}

export async function checkBulkSmsNigeriaBalanceHandler(
  input: {
    environment: BulkSmsEnvironment;
    apiToken?: string | null | undefined;
  },
  context: AuthContext,
) {
  const { supabase, userId } = context;
  await assertCanIssue(supabase, userId);

  return checkBulkSmsNigeriaBalanceV2({
    environment: input.environment,
    apiToken: input.apiToken ?? null,
  });
}

export async function processBulkSmsWebhookHandler(
  input: {
    message_id: string;
    recipient: string;
    delivery_status: string;
    customer_reference?: string | null | undefined;
  },
  context: AuthContext,
) {
  const { supabase, userId } = context;
  await assertCanIssue(supabase, userId);

  const delivered = isBulkSmsDelivered(input.delivery_status);
  const mappedStatus = delivered ? "delivered" : "failed";

  // Idempotent update keyed on gateway_reference = message_id (or customer_reference = alert_id)
  if (input.message_id) {
    await supabase
      .from("alert_deliveries")
      .update({
        status: mappedStatus,
        error_detail: delivered ? null : `BulkSMS DLR status: ${input.delivery_status}`,
      })
      .eq("gateway_reference", input.message_id);
  }

  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "bulksms_nigeria.dlr_webhook",
    detail: {
      message_id: input.message_id,
      recipient: input.recipient,
      delivery_status: input.delivery_status,
      mapped_status: mappedStatus,
      customer_reference: input.customer_reference ?? null,
    },
  });

  return {
    ok: true,
    messageId: input.message_id,
    recipient: input.recipient,
    rawDeliveryStatus: input.delivery_status,
    mappedStatus,
    customerReference: input.customer_reference ?? null,
  };
}
