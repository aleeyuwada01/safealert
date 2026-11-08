# National SafeAlert System — Master Implementation Plan

## Objective
Transform the **National SafeAlert System (Launchpad Connect)** into a complete, production-ready national emergency warning platform capable of hooking directly into telecom (3GPP Cell Broadcast, SMPP 3.4 SMS), satellite (NTN Direct-to-Device, L-Band), Wi-Fi captive portal, and municipal IP siren provider APIs, complete with an interactive API testing sandbox and an upgraded command-center design system.

---

## Phase 1: Context & Memory Tracking (`context/`)
- [x] Create `context/IMPLEMENTATION_PLAN.md`
- [x] Create `context/PROGRESS.md`
- [x] Create `context/ARCHITECTURE_MEMORY.md`

## Phase 2: Provider API Dispatch Engine & CAP 1.2 Standard (`src/lib/`)
- [x] Upgrade `src/lib/dispatch.server.ts`:
  - Canonical CAP 1.2 XML (`buildCapXmlDocument`) and JSON (`buildCapPayload`) builders.
  - Outbound HMAC-SHA256 webhook signing (`X-SafeAlert-Signature`, `X-SafeAlert-Timestamp`, `X-SafeAlert-Channel`, `X-SafeAlert-Authority`).
  - Dynamic gateway URL resolution (supports both `process.env.*` secrets and live `https://` endpoints stored on `public.channel_gateways` rows).
  - `testGatewayDispatch()` function for testing live provider webhooks and measuring real round-trip latency.
- [x] Upgrade `src/lib/alerts.server.ts` & `src/lib/alerts.functions.ts`:
  - Support two-person approval workflow (`requireApproval` flag on `issueAlert`, plus `approveAlert` server function).
  - Add `testGateway` server function for interactive gateway testing and heartbeat updates.

## Phase 3: Design System & Global UI Polish (`src/styles.css`, `src/components/`)
- [x] Enhance `src/styles.css` with command-card surfaces, tactical grid backgrounds, status pulse animations, and refined typography.
- [x] Upgrade `src/components/site-header.tsx` & `src/components/site-footer.tsx` with live network status telemetry bar, compliance standard badges, and emergency command navigation.

## Phase 4: Public Portal & Citizen Experience (`src/routes/`)
- [x] Upgrade `src/routes/index.tsx` with live Supabase network telemetry counters, active warning ticker banner, and interactive national coverage zone overview.
- [x] Upgrade `src/routes/alerts.tsx` with Hazard/Status filters, citizen receipt acknowledgements, Web Audio 853/960Hz siren synthesis, and CAP 1.2 XML payload inspector.
- [x] Upgrade `src/routes/integrations.tsx` with HMAC-SHA256 signature verification code examples and provider webhook integration specs.

## Phase 5: Operator Command Console (`src/routes/console/`)
- [x] Upgrade `src/routes/console/route.tsx` with live UTC command clock, active nav states, and operator role badges.
- [x] Upgrade `src/routes/console/index.tsx` with Two-Person Pending Approval queue, per-channel delivery telemetry bars, CAP 1.2 XML inspector, and real-time audit log.
- [x] Upgrade `src/routes/console/compose.tsx` with 1-click Emergency Scenario Templates, Mobile Handset Lock-Screen Preview, CAP 1.2 XML/JSON preview, and Two-Person Approval toggle.
- [x] Upgrade `src/routes/console/network.tsx` with the interactive **Provider API & Webhook Test Sandbox**, Gateway CRUD, Coverage Zone CRUD, and Operator Role management.

## Phase 6: Verification & Build Validation
- [x] TypeScript validation (`npx tsc --noEmit`)
- [x] Live Dev Server & SSR verification (`http://localhost:8080/`)
- [x] Update `context/PROGRESS.md` with final completion report.
