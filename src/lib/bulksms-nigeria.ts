export type BulkSmsEnvironment = "sandbox" | "production";
export type BulkSmsGatewayRoute =
  | "direct-refund"
  | "corporate"
  | "direct-corporate"
  | "otp"
  | "international";

export const BULKSMS_NIGERIA_BASE_URLS: Record<BulkSmsEnvironment, string> = {
  production: "https://www.bulksmsnigeria.com/api/v2",
  sandbox: "https://www.bulksmsnigeria.com/api/sandbox/v2",
};

export interface BulkSmsSendRequest {
  from: string; // max 11 chars
  to: string; // comma-separated international phone numbers e.g. "2347037770033,2349050030090"
  body: string;
  gateway?: BulkSmsGatewayRoute;
  append_sender?: "none" | "hosted" | "all";
  unicode?: boolean;
  callback_url?: string;
  customer_reference?: string;
}

export interface BulkSmsCodeInfo {
  code: string;
  httpStatus: number;
  category: "Success" | "Authentication" | "Validation" | "Business Logic" | "Not Found" | "Server Error";
  description: string;
  retryable: boolean;
}

export const BSNG_ERROR_CODES: Record<string, BulkSmsCodeInfo> = {
  "BSNG-0000": {
    code: "BSNG-0000",
    httpStatus: 200,
    category: "Success",
    description: "Request completed successfully.",
    retryable: false,
  },
  "BSNG-1001": {
    code: "BSNG-1001",
    httpStatus: 401,
    category: "Authentication",
    description: "Invalid or missing API token.",
    retryable: false,
  },
  "BSNG-1002": {
    code: "BSNG-1002",
    httpStatus: 401,
    category: "Authentication",
    description: "Account has been disabled.",
    retryable: false,
  },
  "BSNG-1003": {
    code: "BSNG-1003",
    httpStatus: 401,
    category: "Authentication",
    description: "Account is dormant (inactive).",
    retryable: false,
  },
  "BSNG-1005": {
    code: "BSNG-1005",
    httpStatus: 403,
    category: "Authentication",
    description: "Account requires pre-approval before sending.",
    retryable: false,
  },
  "BSNG-1007": {
    code: "BSNG-1007",
    httpStatus: 403,
    category: "Authentication",
    description: "API access has been restricted.",
    retryable: false,
  },
  "BSNG-1008": {
    code: "BSNG-1008",
    httpStatus: 403,
    category: "Authentication",
    description: "API access has been disabled.",
    retryable: false,
  },
  "BSNG-1009": {
    code: "BSNG-1009",
    httpStatus: 403,
    category: "Authentication",
    description: "IP address not in whitelist.",
    retryable: false,
  },
  "BSNG-2000": {
    code: "BSNG-2000",
    httpStatus: 422,
    category: "Validation",
    description: "Validation failed. Check error.details for invalid parameters.",
    retryable: false,
  },
  "BSNG-2001": {
    code: "BSNG-2001",
    httpStatus: 422,
    category: "Validation",
    description: "Required 'from' parameter (Sender ID) is missing.",
    retryable: false,
  },
  "BSNG-2002": {
    code: "BSNG-2002",
    httpStatus: 422,
    category: "Validation",
    description: "Required 'body' parameter is missing or contains only stripped Unicode/emoji.",
    retryable: false,
  },
  "BSNG-2003": {
    code: "BSNG-2003",
    httpStatus: 422,
    category: "Validation",
    description: "Required 'to' parameter (recipients) is missing.",
    retryable: false,
  },
  "BSNG-2004": {
    code: "BSNG-2004",
    httpStatus: 422,
    category: "Validation",
    description: "Invalid sender ID format (maximum 11 characters).",
    retryable: false,
  },
  "BSNG-2006": {
    code: "BSNG-2006",
    httpStatus: 422,
    category: "Validation",
    description: "Invalid recipient phone number format.",
    retryable: false,
  },
  "BSNG-2008": {
    code: "BSNG-2008",
    httpStatus: 422,
    category: "Validation",
    description: "Message exceeds maximum permitted length.",
    retryable: false,
  },
  "BSNG-2010": {
    code: "BSNG-2010",
    httpStatus: 422,
    category: "Validation",
    description: "Message contains prohibited content.",
    retryable: false,
  },
  "BSNG-2011": {
    code: "BSNG-2011",
    httpStatus: 403,
    category: "Validation",
    description: "Sender ID is not registered or not yet approved on your BulkSMS Nigeria account.",
    retryable: false,
  },
  "BSNG-2012": {
    code: "BSNG-2012",
    httpStatus: 409,
    category: "Validation",
    description: "Duplicate message sent to same recipients within the last minute. Not charged.",
    retryable: false,
  },
  "BSNG-2013": {
    code: "BSNG-2013",
    httpStatus: 422,
    category: "Validation",
    description: "Message not permitted on this route (use corporate/OTP route for OTPs).",
    retryable: false,
  },
  "BSNG-3001": {
    code: "BSNG-3001",
    httpStatus: 402,
    category: "Business Logic",
    description: "Insufficient wallet balance (or balance below ₦500). Top up to ₦1,000+ to resume.",
    retryable: false,
  },
  "BSNG-3002": {
    code: "BSNG-3002",
    httpStatus: 422,
    category: "Business Logic",
    description: "No valid recipients found.",
    retryable: false,
  },
  "BSNG-3003": {
    code: "BSNG-3003",
    httpStatus: 429,
    category: "Business Logic",
    description: "Daily sending limit exceeded.",
    retryable: false,
  },
  "BSNG-3004": {
    code: "BSNG-3004",
    httpStatus: 429,
    category: "Business Logic",
    description: "Rate limit exceeded (120 req/min Sandbox, 1000 req/min Production).",
    retryable: true,
  },
  "BSNG-3006": {
    code: "BSNG-3006",
    httpStatus: 503,
    category: "Business Logic",
    description: "SMS gateway temporarily unavailable or down.",
    retryable: true,
  },
  "BSNG-3008": {
    code: "BSNG-3008",
    httpStatus: 403,
    category: "Business Logic",
    description: "International messaging not enabled for account.",
    retryable: false,
  },
  "BSNG-3009": {
    code: "BSNG-3009",
    httpStatus: 403,
    category: "Business Logic",
    description: "Insufficient recharge history (₦200,000 minimum for international).",
    retryable: false,
  },
  "BSNG-4001": {
    code: "BSNG-4001",
    httpStatus: 404,
    category: "Not Found",
    description: "No message with the given message_id exists on your account.",
    retryable: false,
  },
  "BSNG-5001": {
    code: "BSNG-5001",
    httpStatus: 500,
    category: "Server Error",
    description: "Internal server error on BulkSMS Nigeria gateway.",
    retryable: true,
  },
  "BSNG-5003": {
    code: "BSNG-5003",
    httpStatus: 503,
    category: "Server Error",
    description: "Service temporarily unavailable.",
    retryable: true,
  },
  "BSNG-5004": {
    code: "BSNG-5004",
    httpStatus: 504,
    category: "Server Error",
    description: "Gateway timeout.",
    retryable: true,
  },
};

export function describeBsngCode(code: string | undefined | null): BulkSmsCodeInfo | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return BSNG_ERROR_CODES[normalized] ?? null;
}

/**
 * Per BulkSMS Nigeria webhook spec:
 * "Treat delivrd, delivered and success as delivered. Treat any other value as not delivered."
 */
export function isBulkSmsDelivered(deliveryStatus: string | undefined | null): boolean {
  if (!deliveryStatus) return false;
  const s = deliveryStatus.trim().toLowerCase();
  return s === "delivrd" || s === "delivered" || s === "success";
}

export function sanitizeSenderId(from: string): string {
  const cleaned = from.trim().slice(0, 11);
  return cleaned || "SafeAlert";
}

