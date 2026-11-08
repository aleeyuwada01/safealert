# National SafeAlert System — Architecture & Project Memory

## 1. Project Identity & Live Infrastructure
- **Application Name**: SafeAlert — National Public Warning & Epidemic Intelligence Platform
- **Canonical Production Domain**: `https://safealert.live`
- **Public REST API Base URL**: `https://safealert.live/api/v1`
- **GitHub Repository**: `https://github.com/aleeyuwada01/safealert`
- **Operator Entity**: GITMATRIX LIMITED (RC: 1751492) / National Emergency Management Agency (NEMA)
- **Supabase Project Name**: `alert system`
- **Supabase Project ID / Ref**: `mnwbcvehgraxewecwrfq`
- **Supabase URL**: `https://mnwbcvehgraxewecwrfq.supabase.co`
- **Demo Accounts**:
  - **Command Operator / Admin Portal (`/console`)**:
    - Email: `operator@safealert.live`
    - Password: `SafeAlert2026!`
    - Roles: `admin`, `operator`
  - **Developer & Business API Portal (`/developers`)**:
    - Email: `dev@acme.ng`
    - Password: `SafeAlertDev2026!`
    - Default Seeded API Key: `sa_live_7f9a2b4c8e1d3f5a9c0b2e4d6f8a1c3e5b7d9f0a`

---

## 2. Database Schema (`public`)
- `profiles`: Operator & partner profile metadata (`id`, `full_name`, `agency`, `phone`)
- `user_roles`: RBAC assignments (`admin`, `operator`, `viewer`)
- `zones`: Geographic coverage zones (`code`, `name`, `region`, `population_estimate`, `centre_lat`, `centre_lng`)
- `alerts`: Master alert records (`hazard`, `severity`, `status`, `headline`, `message`, `instructions`, `languages`, `siren_enabled`, `evacuation_map_url`, `issued_at`, `effective_at`, `expires_at`, `created_by`, `approved_by`, `approved_at`)
- `alert_zones`: Many-to-many join between `alerts` and `zones`
- `channel_gateways`: Registered provider gateways (`channel`, `name`, `operator_name`, `protocol`, `endpoint`, `region`, `is_active`, `health`, `last_heartbeat_at`)
- `alert_deliveries`: Per-zone, per-channel dispatch telemetry (`alert_id`, `zone_id`, `gateway_id`, `channel`, `status`, `devices_targeted`, `devices_reached`, `latency_ms`, `gateway_reference`, `error_detail`)
- `alert_acknowledgements`: Anonymous citizen device receipt confirmations (`alert_id`, `zone_code`, `device_hash`)
- `audit_log`: Immutable operator action log (`actor_id`, `action`, `alert_id`, `detail`, `created_at`)
- `sms_recipients`: Saved BulkSMS recipient phone directory (`phone_number` normalized to `234...`, `full_name`, `group_tag`, `zone_code`, `network` auto-detected as `MTN`/`Airtel`/`Glo`/`9mobile`, `is_active`, `delivery_count`, `last_dispatched_at`, `last_status`)
- `sms_broadcast_campaigns`: Audit log of smart SMS & Voice TTS campaigns (`title`, `alert_id`, `message_body`, `sanitized_body`, `sender_id`, `gateway_route`, `environment`, `recipients_count`, `target_numbers`, `bsng_code`, `bsng_message_id`, `cost_ngn`, `status`)
- `sms_provider_settings`: Persistent Admin configuration for BulkSMS Nigeria v2 (`id = 'default'`, `auth_mode` = `'api_token'` | `'login_credentials'`, `api_token`, `account_email`, `account_password`, `default_sender_id`, `default_environment`, `default_gateway_route`, `last_balance_ngn`, `last_verified_at`)
- `developer_api_keys`: Partner & business REST API keys (`name`, `organization`, `environment`, `key_prefix`, `api_key`, `scopes`, `rate_limit_per_min`, `requests_count`, `last_used_at`, `is_active`)
- `developer_webhooks`: Partner HMAC-SHA256 outbound webhook subscriptions (`name`, `target_url`, `signing_secret`, `events`, `zone_codes`, `is_active`, `last_triggered_at`, `last_status_code`)

---

## 3. Supported Delivery Channels & Environment Secrets
| Channel | Enum Value | Protocol | Environment Variables / DB Config |
| :--- | :--- | :--- | :--- |
| Cell Broadcast | `cell_broadcast` | 3GPP CBS / CMAS | `CBC_ENDPOINT`, `CBC_API_KEY` |
| BulkSMS Nigeria v2 | `sms` | BulkSMS Nigeria v2 (`/api/v2` & `/api/sandbox/v2`) / SMPP 3.4 | Saved in Admin UI (`public.sms_provider_settings`) or `BULKSMS_NIGERIA_API_TOKEN` |
| Satellite | `satellite` | NTN D2D / L-Band | `SATELLITE_ENDPOINT`, `SATELLITE_API_KEY` |
| Wi-Fi Push | `wifi_push` | WebPush / Captive | `WIFI_PUSH_ENDPOINT`, `WIFI_PUSH_API_KEY` |
| Siren Grid | `siren` | SIP / RTP over IP | `SIREN_ENDPOINT`, `SIREN_API_KEY` |
| Webhook Signing | All Channels | HMAC-SHA256 | `SAFEALERT_SIGNING_SECRET` |

---

## 4. Public REST API v1 Endpoints (`src/server.ts` & `src/lib/developer-api.server.ts`)
- `GET /api/v1/alerts` — Active & recent OASIS CAP 1.2 emergency broadcasts (`?zone=LAG-METRO&severity=extreme&limit=25`)
- `GET /api/v1/intelligence` — Autonomous WHO Disease Outbreak News, NCDC SitReps, Nigeria Outbreak RSS, and Open-Meteo weather hazards
- `GET /api/v1/zones` — National geographic coverage zones, centroids, and population estimates
- `GET /api/v1/status` — Platform health, channel gateway availability, and API key rate-limit status
