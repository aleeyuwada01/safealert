# National SafeAlert System — Master Implementation Plan

## Objective
Transform **SafeAlert (`https://safealert.live`)** into a complete, production-ready national emergency warning and autonomous epidemic surveillance platform with:
1. Multi-channel telecom & satellite dispatch (3GPP Cell Broadcast, BulkSMS Nigeria API v2 & Sandbox v2, NTN Direct-to-Device Satellite, Captive Wi-Fi, and SIP/RTP Municipal Sirens).
2. Autonomous live intelligence ingestion from official WHO, NCDC, Nigeria Outbreak RSS, and Open-Meteo APIs with on-demand **Sync Sources**.
3. Smart BulkSMS Recipient Directory, Telco DND Block-Word Sanitizer, and persistent Admin credential configuration (via API Token or Account Login).
4. Public REST API v1 (`/api/v1/*`) and Developer Portal (`/developers`) with API key provisioning, live playground, and HMAC-SHA256 webhooks.

---

## Phase 1: Context & Memory Tracking (`context/`)
- [x] Create and maintain `context/IMPLEMENTATION_PLAN.md`
- [x] Create and maintain `context/PROGRESS.md`
- [x] Create and maintain `context/ARCHITECTURE_MEMORY.md`

## Phase 2: Provider API Dispatch Engine & CAP 1.2 Standard (`src/lib/`)
- [x] Upgrade `src/lib/dispatch.server.ts`:
  - Canonical CAP 1.2 XML (`buildCapXmlDocument`) and JSON (`buildCapPayload`) builders with `alerts@safealert.live` sender authority.
  - Outbound HMAC-SHA256 webhook signing (`X-SafeAlert-Signature`, `X-SafeAlert-Timestamp`, `X-SafeAlert-Channel`, `X-SafeAlert-Authority`).
  - BulkSMS Nigeria v2 (`https://www.bulksmsnigeria.com/api/v2`) and Sandbox v2 (`/api/sandbox/v2`) integration supporting `Authorization: Bearer`, `api_token` header, and JSON body authentication, Voice TTS (`/voice/create`), wallet balance checks (`/balance`), and `BSNG-0000`–`BSNG-5004` error decoding.

## Phase 3: Autonomous Live Pandemic & Weather Intelligence (`src/lib/live-intel.*`)
- [x] Build `src/lib/live-intel.server.ts` & `src/lib/live-intel.functions.ts`:
  - Live ingestion from WHO Disease Outbreak News REST API (`2026-DON622`), NCDC Situation Reports scraper, Nigeria Outbreak RSS feed, and Open-Meteo Meteorological API.
  - Interactive `syncLiveIntelligence` server function wired to the **"Sync Sources"** button on `/alerts` and `/console` with per-source latency and item counts.

## Phase 4: Smart BulkSMS Directory, Telco Sanitizer & Admin Credential Setup
- [x] Create `public.sms_recipients`, `public.sms_broadcast_campaigns`, and `public.sms_provider_settings` in Supabase (`mnwbcvehgraxewecwrfq`).
- [x] Build `src/lib/telco-compliance.ts` for Nigerian MSISDN normalization (`234...`), MNO carrier detection (`MTN`, `Airtel`, `Glo`, `9mobile`), and real-time DND/spam/phishing block-word detection + 1-click auto-sanitization.
- [x] Build `src/components/smart-sms-manager.tsx` in `/console/network`:
  - Persistent Admin BulkSMS setup supporting both **API Token** mode and **BulkSMS Account Login & Secret** mode (`saveSmsProviderSettings`).
  - Single/bulk phone number directory management and multi-alert/template campaign broadcasting.

## Phase 5: SafeAlert Public REST API v1 & Dual-Role Developer Portal (`/developers` & `/auth`)
- [x] Create `public.developer_api_keys` and `public.developer_webhooks` in Supabase.
- [x] Wire HTTP REST API v1 into `src/server.ts` (`GET /api/v1/alerts`, `/api/v1/intelligence`, `/api/v1/zones`, `/api/v1/status`).
- [x] Build production-grade Developer Portal (`src/routes/developers.tsx`) with API documentation, `SA-XXXX` status codes, rate-limit headers, API key management, live playground, and HMAC-SHA256 webhook testing.
- [x] Add dual-portal login (`src/routes/auth.tsx`) with 1-click demo login buttons for both Command Operator (`operator@safealert.live`) and Developer Partner (`dev@acme.ng`), plus prominent **Log Out** buttons across `/console`, `/developers`, and `SiteHeader`.

## Phase 6: Verification, Vercel Readiness & GitHub Deployment
- [x] TypeScript validation (`npx tsc --noEmit` — 0 errors) and production SSR build (`npm run build` — 0 errors).
- [x] Configure `vercel.json`, `.env.example`, `.gitignore`, and `README.md`.
- [x] Push repository to `https://github.com/aleeyuwada01/safealert`.
