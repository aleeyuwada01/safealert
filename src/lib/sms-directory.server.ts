import { createClient } from "@supabase/supabase-js";
import {
  analyzeTelcoCompliance,
  normalizeNigerianPhone,
  parseBulkPhoneNumbers,
} from "./telco-compliance";
import { sendBulkSmsNigeriaV2 } from "./dispatch.server";
import type { BulkSmsEnvironment, BulkSmsGatewayRoute } from "./bulksms-nigeria";

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

export interface SmsRecipientRow {
  id: string;
  phone_number: string;
  full_name: string;
  group_tag: string;
  zone_code: string;
  network: string;
  is_active: boolean;
  delivery_count: number;
  last_dispatched_at: string | null;
  last_status: string | null;
  notes: string | null;
  created_at: string;
}

export interface SmsCampaignRow {
  id: string;
  title: string;
  alert_id: string | null;
  message_body: string;
  sanitized_body: string;
  sender_id: string;
  gateway_route: string;
  environment: string;
  recipients_count: number;
  target_numbers: string[];
  bsng_code: string | null;
  bsng_message_id: string | null;
  cost_ngn: number | null;
  status: string;
  created_at: string;
}

export async function getSmsDirectoryStateHandler() {
  const db = getDb();
  const [recipientsRes, campaignsRes, alertsRes] = await Promise.all([
    db.from("sms_recipients").select("*").order("created_at", { ascending: false }),
    db
      .from("sms_broadcast_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15),
    db
      .from("alerts")
      .select("id, headline, message, instructions, severity, hazard, status, issued_at")
      .in("status", ["live", "broadcasting"])
      .order("issued_at", { ascending: false }),
  ]);

  return {
    recipients: (recipientsRes.data ?? []) as SmsRecipientRow[],
    campaigns: (campaignsRes.data ?? []) as SmsCampaignRow[],
    activeAlerts: (alertsRes.data ?? []) as Array<{
      id: string;
      headline: string;
      message: string;
      instructions: string | null;
      severity: string;
      hazard: string;
      status: string;
      issued_at: string;
    }>,
  };
}

export async function upsertSmsRecipientsHandler(input: {
  rawNumbers: string;
  fullName?: string | null | undefined;
  groupTag: string;
  zoneCode: string;
  notes?: string | null | undefined;
}) {
  const db = getDb();
  const parsed = parseBulkPhoneNumbers(input.rawNumbers);
  if (parsed.length === 0) {
    throw new Error(
      "No valid phone numbers detected. Enter Nigerian MSISDNs (e.g. 08031234567 or 2348031234567).",
    );
  }

  const rows = parsed.map((entry, idx) => ({
    phone_number: entry.phone_number,
    full_name:
      input.fullName && input.fullName.trim().length > 0
        ? parsed.length === 1
          ? input.fullName.trim()
          : `${input.fullName.trim()} #${idx + 1}`
        : `${input.groupTag} Contact (${entry.phone_number.slice(-4)})`,
    group_tag: input.groupTag || "Public",
    zone_code: input.zoneCode || "ALL",
    network: entry.network,
    is_active: true,
    notes: input.notes ?? null,
  }));

  const { data, error } = await db
    .from("sms_recipients")
    .upsert(rows, { onConflict: "phone_number" })
    .select("*");

  if (error) throw new Error(error.message);
  return {
    addedCount: (data ?? []).length,
    recipients: (data ?? []) as SmsRecipientRow[],
  };
}

export async function toggleSmsRecipientHandler(input: { id: string; is_active: boolean }) {
  const db = getDb();
  const { error } = await db
    .from("sms_recipients")
    .update({ is_active: input.is_active })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteSmsRecipientHandler(input: { id: string }) {
  const db = getDb();
  const { error } = await db.from("sms_recipients").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function dispatchSmartSmsCampaignHandler(input: {
  title: string;
  recipientIds: string[];
  extraNumbers?: string | null | undefined;
  alertId?: string | null | undefined;
  messageBody: string;
  autoSanitize?: boolean | undefined;
  senderId: string;
  gatewayRoute: BulkSmsGatewayRoute;
  environment: BulkSmsEnvironment;
  mode: "sms" | "voice";
  apiToken?: string | null | undefined;
}) {
  const db = getDb();

  // 1. Analyze and sanitize telco block-words
  const compliance = analyzeTelcoCompliance(input.messageBody);
  const finalBody =
    input.autoSanitize !== false ? compliance.sanitizedText : input.messageBody.trim();

  // 2. Resolve recipient phone numbers
  const numberSet = new Set<string>();
  let matchedRows: SmsRecipientRow[] = [];

  if (input.recipientIds.length > 0) {
    const { data } = await db
      .from("sms_recipients")
      .select("*")
      .in("id", input.recipientIds);
    matchedRows = (data ?? []) as SmsRecipientRow[];
    for (const r of matchedRows) {
      numberSet.add(r.phone_number);
    }
  }

  if (input.extraNumbers && input.extraNumbers.trim().length > 0) {
    for (const entry of parseBulkPhoneNumbers(input.extraNumbers)) {
      numberSet.add(entry.phone_number);
    }
  }

  const targetNumbers = Array.from(numberSet).map((n) => normalizeNigerianPhone(n).phone_number);
  if (targetNumbers.length === 0) {
    throw new Error("Select at least one recipient from the directory or enter a phone number.");
  }

  // 3. Dispatch via BulkSMS Nigeria v2
  const toCsv = targetNumbers.join(",");
  const dispatchResult = await sendBulkSmsNigeriaV2({
    environment: input.environment,
    mode: input.mode,
    apiToken: input.apiToken ?? null,
    from: input.senderId,
    to: toCsv,
    body: finalBody,
    gateway: input.gatewayRoute,
    unicode: compliance.encoding === "UNICODE",
    customerReference: `campaign-${Date.now()}`,
  });

  // 4. Update delivery counters on targeted recipients
  const nowIso = new Date().toISOString();
  for (const row of matchedRows) {
    await db
      .from("sms_recipients")
      .update({
        delivery_count: (row.delivery_count ?? 0) + 1,
        last_dispatched_at: nowIso,
        last_status: dispatchResult.ok ? "delivered" : `bsng_${dispatchResult.bsngCode}`,
      })
      .eq("id", row.id);
  }

  // 5. Save campaign record
  const { data: campaignData } = await db
    .from("sms_broadcast_campaigns")
    .insert({
      title: input.title,
      alert_id: input.alertId || null,
      message_body: input.messageBody,
      sanitized_body: finalBody,
      sender_id: input.senderId,
      gateway_route: input.gatewayRoute,
      environment: input.environment,
      recipients_count: targetNumbers.length,
      target_numbers: targetNumbers,
      bsng_code: dispatchResult.bsngCode,
      bsng_message_id: dispatchResult.messageId,
      cost_ngn: dispatchResult.cost ?? 0,
      status: dispatchResult.ok ? "delivered" : "dispatched_pending_token",
    })
    .select("*")
    .single();

  return {
    dispatchResult,
    compliance,
    finalBody,
    targetNumbers,
    campaign: campaignData as SmsCampaignRow | null,
  };
}
