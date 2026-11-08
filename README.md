# SafeAlert — Be Aware. Stay Safe. (`safealert.live`)

Unified Multi-Hazard Public Warning & Autonomous Epidemic Surveillance Platform built on **OASIS CAP 1.2**, **3GPP TS 23.041 Cell Broadcast**, **BulkSMS Nigeria API v2**, **Direct-to-Device Satellite**, and **SafeAlert Public REST API v1**.

---

## Key Capabilities

1. **Autonomous Live Government & Pandemic Surveillance (`src/lib/live-intel.server.ts`)**
   - Polls **WHO Official Disease Outbreak News REST API** (`https://www.who.int/api/news/diseaseoutbreaknews`), **NCDC Situation Reports Scraper** (`https://ncdc.gov.ng/diseases/sitreps`), **Verified Nigeria Health & Emergency RSS**, and **Open-Meteo Nigerian Zone Telemetry** (`LAG-METRO`, `FCT-ABJ`, `KAN-NORTH`, `RIV-DELTA`).
   - Operates automatically without manual data uploads and synchronizes directly into the Supabase `alerts` table when **Sync Live Sources** is triggered.

2. **Smart BulkSMS Recipient Directory & Telco Block-Word Shield (`/console/network`)**
   - Persistent phone number directory (`public.sms_recipients`) with single or bulk paste, automatic normalization to 13-digit Nigerian MSISDNs (`234...`), and automatic carrier detection (**MTN, Airtel, Glo, 9mobile**).
   - Push a **specific alert**, **selected/all active alerts**, or **predefined emergency templates** with real-time Nigerian MNO DND/spam/phishing block-word detection and 1-click auto-sanitization (`src/lib/telco-compliance.ts`).
   - Full integration with **BulkSMS Nigeria API v2** (`/api/v2/sms`, `/api/sandbox/v2/sms`, `/api/v2/voice/create`, `/api/v2/balance`, delivery webhooks, and `BSNG-0000`–`BSNG-5004` error decoding).

3. **Developer & Business REST API v1 Portal (`/developers`)**
   - Self-service API key provisioning (`sa_live_...` and `sa_test_...`) stored in `public.developer_api_keys` with rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) and usage telemetry.
   - Live HTTP REST endpoints:
     - `GET /api/v1/alerts?zone=LAG-METRO&severity=extreme`
     - `GET /api/v1/intelligence?zone=FCT-ABJ`
     - `GET /api/v1/zones`
     - `GET /api/v1/status`
   - Outbound HMAC-SHA256 signed business webhooks (`public.developer_webhooks` with `X-SafeAlert-Signature`).

---

## Ready-to-Use Demo Accounts (`/auth`)

| Portal | Email | Password | Destination |
| :--- | :--- | :--- | :--- |
| **Admin / Command Operator** | `operator@safealert.live` | `SafeAlert2026!` | `/console` & `/console/network` |
| **Developer / Business Partner** | `dev@acme.ng` | `SafeAlertDev2026!` | `/developers` |

---

## Local Development

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:8080`.

---

## Deploying to GitHub & Vercel

This project is pre-configured with `vercel.json` and automatic Nitro Vercel Build Output API v3 detection in `vite.config.ts` (`process.env.VERCEL ? "vercel" : "node-server"`).

### 1. Push to GitHub
```bash
git add .
git commit -m "chore: production-ready SafeAlert platform, Smart BulkSMS manager, and REST API v1"
git push origin main
```

### 2. Import in Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
2. Vercel will automatically detect `vercel.json` (`npm run build`).
3. Add the following Environment Variables in your Vercel Project Settings (also see `.env.example`):
   - `VITE_SUPABASE_URL` = `https://mnwbcvehgraxewecwrfq.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_YeLqAJsJPW3F9fODvFYoHA_D59vPyyl`
   - `SUPABASE_URL` = `https://mnwbcvehgraxewecwrfq.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_YeLqAJsJPW3F9fODvFYoHA_D59vPyyl`
   - `BULKSMS_NIGERIA_API_TOKEN` = *(optional — your BulkSMS Nigeria v2 Bearer token)*
4. Click **Deploy**.
