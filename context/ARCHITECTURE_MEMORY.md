# National SafeAlert System — Architecture & Project Memory

## 1. Project Identity & Live Infrastructure
- **Application Name**: National SafeAlert System (Launchpad Connect)
- **Operator Entity**: GITMATRIX LIMITED (RC: 1751492) / National Emergency Management Agency (NEMA)
- **Supabase Project Name**: `alert system`
- **Supabase Project ID / Ref**: `mnwbcvehgraxewecwrfq`
- **Supabase URL**: `https://mnwbcvehgraxewecwrfq.supabase.co`
- **Test Operator Account**:
  - Email: `operator@safealert.gov`
  - Password: `SafeAlert2026!`
  - Roles: `admin`, `operator`

## 2. Database Schema (`public`)
- `profiles`: Operator profile metadata (`id`, `full_name`, `agency`, `phone`)
- `user_roles`: RBAC assignments (`admin`, `operator`, `viewer`)
- `zones`: Geographic coverage zones (`code`, `name`, `region`, `population_estimate`, `centre_lat`, `centre_lng`)
- `alerts`: Master alert records (`hazard`, `severity`, `status`, `headline`, `message`, `instructions`, `languages`, `siren_enabled`, `evacuation_map_url`, `issued_at`, `effective_at`, `expires_at`, `created_by`, `approved_by`, `approved_at`)
- `alert_zones`: Many-to-many join between `alerts` and `zones`
- `channel_gateways`: Registered provider gateways (`channel`, `name`, `operator_name`, `protocol`, `endpoint`, `region`, `is_active`, `health`, `last_heartbeat_at`)
- `alert_deliveries`: Per-zone, per-channel dispatch telemetry (`alert_id`, `zone_id`, `gateway_id`, `channel`, `status`, `devices_targeted`, `devices_reached`, `latency_ms`, `gateway_reference`, `error_detail`)
- `alert_acknowledgements`: Anonymous citizen device receipt confirmations (`alert_id`, `zone_code`, `device_hash`)
- `audit_log`: Immutable operator action log (`actor_id`, `action`, `alert_id`, `detail`, `created_at`)

## 3. Supported Delivery Channels & Environment Secrets
| Channel | Enum Value | Protocol | Environment Variables (Optional Override) |
| :--- | :--- | :--- | :--- |
| Cell Broadcast | `cell_broadcast` | 3GPP CBS / CMAS | `CBC_ENDPOINT`, `CBC_API_KEY` |
| Bulk SMS | `sms` | SMPP 3.4 / HTTP | `SMPP_HTTP_ENDPOINT`, `SMPP_API_KEY` |
| Satellite | `satellite` | NTN D2D / L-Band | `SATELLITE_ENDPOINT`, `SATELLITE_API_KEY` |
| Wi-Fi Push | `wifi_push` | WebPush / Captive | `WIFI_PUSH_ENDPOINT`, `WIFI_PUSH_API_KEY` |
| Siren Grid | `siren` | SIP / RTP over IP | `SIREN_ENDPOINT`, `SIREN_API_KEY` |
| Webhook Signing | All Channels | HMAC-SHA256 | `SAFEALERT_SIGNING_SECRET` (defaults to authority dev key if unset) |

*Note*: If a gateway record in `public.channel_gateways` has an `https://` or `http://` endpoint configured (and is not a placeholder `.example` or `.gov` demo URI), the dispatcher can also target it directly during live dispatches and sandbox tests.

