import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getDeveloperWorkspaceHandler,
  createDeveloperApiKeyHandler,
  toggleDeveloperApiKeyHandler,
  deleteDeveloperApiKeyHandler,
  createDeveloperWebhookHandler,
  deleteDeveloperWebhookHandler,
  triggerDeveloperWebhookTestHandler,
  executePublicApiV1Request,
} from "./developer-api.server";

export const getDeveloperWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  return getDeveloperWorkspaceHandler();
});

export const createDeveloperApiKey = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid().optional().nullable(),
      name: z.string().min(2).max(120),
      organization: z.string().min(2).max(120),
      environment: z.enum(["live", "test"]),
      scopes: z.array(z.string()).min(1),
      rateLimitPerMin: z.number().int().min(10).max(10000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    return createDeveloperApiKeyHandler(data);
  });

export const toggleDeveloperApiKey = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      is_active: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    return toggleDeveloperApiKeyHandler(data);
  });

export const deleteDeveloperApiKey = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    return deleteDeveloperApiKeyHandler(data);
  });

export const createDeveloperWebhook = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid().optional().nullable(),
      name: z.string().min(2).max(120),
      targetUrl: z.string().url().max(500),
      events: z.array(z.string()).min(1),
      zoneCodes: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ data }) => {
    return createDeveloperWebhookHandler(data);
  });

export const deleteDeveloperWebhook = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    return deleteDeveloperWebhookHandler(data);
  });

export const triggerDeveloperWebhookTest = createServerFn({ method: "POST" })
  .inputValidator(z.object({ webhookId: z.string().uuid() }))
  .handler(async ({ data }) => {
    return triggerDeveloperWebhookTestHandler(data);
  });

export const runDeveloperApiPlayground = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      apiKey: z.string().min(1).max(300),
      endpoint: z.enum([
        "/api/v1/alerts",
        "/api/v1/intelligence",
        "/api/v1/zones",
        "/api/v1/status",
      ]),
      zoneFilter: z.string().optional().nullable(),
      severityFilter: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    return executePublicApiV1Request(data);
  });

