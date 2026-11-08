import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { executePublicApiV1Request } from "./lib/developer-api.server";

async function handlePublicRestApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/")) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
      },
    });
  }

  const validPaths = [
    "/api/v1/alerts",
    "/api/v1/intelligence",
    "/api/v1/zones",
    "/api/v1/status",
  ] as const;
  const endpoint = validPaths.find((p) => url.pathname === p || url.pathname === `${p}/`);
  if (!endpoint) {
    return new Response(
      JSON.stringify({
        status: "error",
        code: "SA-4004",
        error: `Unknown endpoint ${url.pathname}. Available endpoints: ${validPaths.join(", ")}`,
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("x-api-key") ||
    url.searchParams.get("api_key") ||
    "";

  const result = await executePublicApiV1Request({
    apiKey: authHeader,
    endpoint,
    zoneFilter: url.searchParams.get("zone"),
    severityFilter: url.searchParams.get("severity"),
  });

  return new Response(JSON.stringify(result.body, null, 2), {
    status: result.httpStatus,
    headers: {
      ...result.headers,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const apiResponse = await handlePublicRestApi(request);
      if (apiResponse) return apiResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
