import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  issueAlertHandler,
  approveAlertHandler,
  cancelAlertHandler,
  testGatewayHandler,
  channelStatusHandler,
  testBulkSmsNigeriaHandler,
  checkBulkSmsNigeriaBalanceHandler,
  processBulkSmsWebhookHandler,
} from "./alerts.server";

const issueSchema = z.object({
  hazard: z.enum(["flood", "heatwave", "security_threat", "epidemic", "other"]),
  severity: z.enum(["advisory", "watch", "warning", "extreme"]),
  headline: z.string().min(6).max(120),
  message: z.string().min(10).max(1200),
  instructions: z.string().max(600).optional().nullable(),
  languages: z.array(z.string().min(2).max(5)).min(1).max(5),
  sirenEnabled: z.boolean(),
  zoneIds: z.array(z.string().uuid()).min(1).max(50),
  channels: z
    .array(z.enum(["cell_broadcast", "sms", "satellite", "wifi_push", "siren"]))
    .min(1)
    .max(5),
  expiresInHours: z.number().int().min(1).max(168),
  evacuationMapUrl: z.string().url().max(500).optional().nullable(),
  requireApproval: z.boolean().optional(),
});

const testGatewaySchema = z.object({
  gatewayId: z.string().uuid().optional().nullable(),
  channel: z.enum(["cell_broadcast", "sms", "satellite", "wifi_push", "siren"]),
  endpointUrl: z.string().max(500).optional().nullable(),
  zoneCode: z.string().max(32).optional(),
  zoneName: z.string().max(120).optional(),
});

const bulkSmsTestSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  mode: z.enum(["sms", "voice"]),
  apiToken: z.string().max(300).optional().nullable(),
  from: z.string().min(1).max(11),
  to: z.string().min(7).max(500),
  body: z.string().min(1).max(1000),
  gateway: z
    .enum(["direct-refund", "corporate", "direct-corporate", "otp", "international"])
    .optional(),
  unicode: z.boolean().optional(),
  callbackUrl: z.string().max(500).optional().nullable(),
  customerReference: z.string().max(120).optional().nullable(),
});

const bulkSmsBalanceSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  apiToken: z.string().max(300).optional().nullable(),
});

const bulkSmsWebhookSchema = z.object({
  message_id: z.string().min(1).max(160),
  recipient: z.string().min(5).max(32),
  delivery_status: z.string().min(1).max(40),
  customer_reference: z.string().max(120).optional().nullable(),
});

export const issueAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => issueSchema.parse(data))
  .handler(async ({ data, context }) => issueAlertHandler(data, context));

export const approveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ alertId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => approveAlertHandler(data.alertId, context));

export const cancelAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ alertId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => cancelAlertHandler(data.alertId, context));

export const testGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => testGatewaySchema.parse(data))
  .handler(async ({ data, context }) => testGatewayHandler(data, context));

export const testBulkSmsNigeria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => bulkSmsTestSchema.parse(data))
  .handler(async ({ data, context }) => testBulkSmsNigeriaHandler(data, context));

export const checkBulkSmsNigeriaBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => bulkSmsBalanceSchema.parse(data))
  .handler(async ({ data, context }) => checkBulkSmsNigeriaBalanceHandler(data, context));

export const simulateBulkSmsDeliveryWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => bulkSmsWebhookSchema.parse(data))
  .handler(async ({ data, context }) => processBulkSmsWebhookHandler(data, context));

export const getChannelStatus = createServerFn({ method: "GET" }).handler(async () =>
  channelStatusHandler(),
);
