import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getSmsDirectoryStateHandler,
  upsertSmsRecipientsHandler,
  toggleSmsRecipientHandler,
  deleteSmsRecipientHandler,
  dispatchSmartSmsCampaignHandler,
  saveSmsProviderSettingsHandler,
} from "./sms-directory.server";

export const getSmsDirectoryState = createServerFn({ method: "GET" }).handler(async () => {
  return getSmsDirectoryStateHandler();
});

export const saveSmsProviderSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      authMode: z.enum(["api_token", "login_credentials"]),
      apiToken: z.string().max(400).optional().nullable(),
      accountEmail: z.string().max(180).optional().nullable(),
      accountPassword: z.string().max(300).optional().nullable(),
      defaultSenderId: z.string().min(1).max(11),
      defaultEnvironment: z.enum(["sandbox", "production"]),
      defaultGatewayRoute: z.enum([
        "direct-refund",
        "corporate",
        "direct-corporate",
        "otp",
        "international",
      ]),
      verifyBalance: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    return saveSmsProviderSettingsHandler(data);
  });

export const upsertSmsRecipients = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      rawNumbers: z.string().min(5).max(10000),
      fullName: z.string().max(120).optional().nullable(),
      groupTag: z.string().min(1).max(60),
      zoneCode: z.string().min(1).max(32),
      notes: z.string().max(300).optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    return upsertSmsRecipientsHandler(data);
  });

export const toggleSmsRecipient = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      is_active: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    return toggleSmsRecipientHandler(data);
  });

export const deleteSmsRecipient = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    return deleteSmsRecipientHandler(data);
  });

export const dispatchSmartSmsCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().min(2).max(140),
      recipientIds: z.array(z.string().uuid()),
      extraNumbers: z.string().max(4000).optional().nullable(),
      alertId: z.string().uuid().optional().nullable(),
      messageBody: z.string().min(5).max(1600),
      autoSanitize: z.boolean().optional(),
      senderId: z.string().min(1).max(11),
      gatewayRoute: z.enum([
        "direct-refund",
        "corporate",
        "direct-corporate",
        "otp",
        "international",
      ]),
      environment: z.enum(["sandbox", "production"]),
      mode: z.enum(["sms", "voice"]),
      apiToken: z.string().max(300).optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    return dispatchSmartSmsCampaignHandler(data);
  });

