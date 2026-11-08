-- ============================================================================
-- National SafeAlert System — Smart BulkSMS Directory & Developer API Platform
-- ============================================================================

-- 1. EXTEND APP_ROLE ENUM WITH 'developer'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';

-- Update handle_new_user trigger so developer signups get 'developer' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  is_first BOOLEAN;
  acct_type TEXT;
BEGIN
  acct_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'operator');

  INSERT INTO public.profiles (id, full_name, agency, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'agency', CASE WHEN acct_type = 'developer' THEN 'Developer Partner' ELSE 'NEMA Operations' END),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  IF acct_type = 'developer' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'developer')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin', 'operator')) INTO is_first;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'operator')
    ON CONFLICT (user_id, role) DO NOTHING;

    IF is_first THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. SMART BULKSMS RECIPIENTS DIRECTORY --------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT 'Citizen Subscriber',
  group_tag TEXT NOT NULL DEFAULT 'Public',
  zone_code TEXT NOT NULL DEFAULT 'ALL',
  network TEXT NOT NULL DEFAULT 'MTN',
  is_active BOOLEAN NOT NULL DEFAULT true,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  last_dispatched_at TIMESTAMPTZ,
  last_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_recipients TO anon, authenticated, service_role;
ALTER TABLE public.sms_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_recipients_read_all" ON public.sms_recipients;
CREATE POLICY "sms_recipients_read_all" ON public.sms_recipients
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "sms_recipients_write_all" ON public.sms_recipients;
CREATE POLICY "sms_recipients_write_all" ON public.sms_recipients
  FOR ALL USING (true) WITH CHECK (true);

-- 3. BULKSMS BROADCAST CAMPAIGNS HISTORY -------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  message_body TEXT NOT NULL,
  sanitized_body TEXT NOT NULL,
  sender_id TEXT NOT NULL DEFAULT 'SafeAlert',
  gateway_route TEXT NOT NULL DEFAULT 'direct-refund',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  recipients_count INTEGER NOT NULL DEFAULT 0,
  target_numbers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  bsng_code TEXT,
  bsng_message_id TEXT,
  cost_ngn NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_broadcast_campaigns TO anon, authenticated, service_role;
ALTER TABLE public.sms_broadcast_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_campaigns_all" ON public.sms_broadcast_campaigns;
CREATE POLICY "sms_campaigns_all" ON public.sms_broadcast_campaigns
  FOR ALL USING (true) WITH CHECK (true);

-- 4. DEVELOPER API KEYS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.developer_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT 'Partner Organization',
  environment TEXT NOT NULL DEFAULT 'live',
  key_prefix TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['alerts:read', 'intelligence:read', 'zones:read', 'webhooks:manage'],
  rate_limit_per_min INTEGER NOT NULL DEFAULT 600,
  requests_count BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_api_keys TO anon, authenticated, service_role;
ALTER TABLE public.developer_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "developer_api_keys_all" ON public.developer_api_keys;
CREATE POLICY "developer_api_keys_all" ON public.developer_api_keys
  FOR ALL USING (true) WITH CHECK (true);

-- 5. DEVELOPER WEBHOOK SUBSCRIPTIONS -----------------------------------------
CREATE TABLE IF NOT EXISTS public.developer_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['alert.live', 'alert.extreme', 'intelligence.epidemic'],
  zone_codes TEXT[] NOT NULL DEFAULT ARRAY['ALL'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_webhooks TO anon, authenticated, service_role;
ALTER TABLE public.developer_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "developer_webhooks_all" ON public.developer_webhooks;
CREATE POLICY "developer_webhooks_all" ON public.developer_webhooks
  FOR ALL USING (true) WITH CHECK (true);

-- 6. SEED SMART BULKSMS RECIPIENTS DIRECTORY ---------------------------------
INSERT INTO public.sms_recipients (phone_number, full_name, group_tag, zone_code, network, is_active, delivery_count, last_status, notes)
VALUES
  ('2347037770033', 'Dr. Adewale Ogunleye (NCDC Liaison)', 'Health Workers', 'LAG-METRO', 'MTN', true, 12, 'delivered', 'Primary Lagos Port Health Surveillance Lead'),
  ('2349050030090', 'Musa Ibrahim (NEMA Zonal Coordinator)', 'First Responders', 'FCT-ABJ', 'Glo', true, 19, 'delivered', 'Abuja National Command Centre Duty Officer'),
  ('2348031234501', 'Chidinma Okafor (Red Cross Command)', 'First Responders', 'LAG-METRO', 'MTN', true, 8, 'delivered', 'Lagos Mainland Rapid Response'),
  ('2348029881122', 'Aminu Kano (State Emergency Agency)', 'First Responders', 'KAN-NORTH', 'Airtel', true, 14, 'delivered', 'Kano North Heat & Epidemic Taskforce'),
  ('2348054432211', 'Dr. Tamuno Briggs (Rivers Teaching Hospital)', 'Health Workers', 'RIV-DELTA', 'Glo', true, 6, 'delivered', 'Port Harcourt Isolation & Flood Triage'),
  ('2348091122334', 'Funke Akindele (Lagos Ferry & Transit Safety)', 'Logistics & Transport', 'LAG-METRO', '9mobile', true, 4, 'delivered', 'Waterways & Commuter Alert Coordinator'),
  ('2348135567890', 'Bello Abdullahi (Community Ward Head)', 'Community Leaders', 'KAN-NORTH', 'MTN', true, 7, 'delivered', 'Kano Municipal Ward Broadcast Lead'),
  ('2347068899001', 'Ngozi Eze (FCT Hospital Dispatch)', 'Health Workers', 'FCT-ABJ', 'MTN', true, 11, 'delivered', 'FCT Ambulance & Epidemic Response')
ON CONFLICT (phone_number) DO NOTHING;

-- 7. SEED INITIAL DEVELOPER API KEYS & WEBHOOKS ------------------------------
INSERT INTO public.developer_api_keys (name, organization, environment, key_prefix, api_key, scopes, rate_limit_per_min, requests_count, last_used_at, is_active)
VALUES
  (
    'Acme Logistics Fleet Safety API',
    'Acme Logistics Nigeria Ltd',
    'live',
    'sa_live_acme_8f92...',
    'sa_live_acme_8f92a1b4c7d0e3f6a9b2c5d8e1f4a7b0',
    ARRAY['alerts:read', 'intelligence:read', 'zones:read', 'webhooks:manage'],
    1000,
    1428,
    now() - interval '4 minutes',
    true
  ),
  (
    'Lagos HMO Hospital Triage Integration',
    'Lagoon & Metro Health Network',
    'live',
    'sa_live_hmo_4d71...',
    'sa_live_hmo_4d71e8c2b9a0f5e3d1c8b7a6f4e2d0c9',
    ARRAY['alerts:read', 'intelligence:read', 'zones:read'],
    600,
    532,
    now() - interval '18 minutes',
    true
  ),
  (
    'Sandbox Development Key',
    'Acme Logistics Nigeria Ltd',
    'test',
    'sa_test_acme_1a2b...',
    'sa_test_acme_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    ARRAY['alerts:read', 'intelligence:read', 'zones:read'],
    120,
    89,
    now() - interval '1 hour',
    true
  )
ON CONFLICT (api_key) DO NOTHING;

INSERT INTO public.developer_webhooks (name, target_url, signing_secret, events, zone_codes, is_active, last_triggered_at, last_status_code)
SELECT
  'Acme Fleet Dispatch Webhook',
  'https://postman-echo.com/post',
  'whsec_sa_99f1c8d2e4b7a0f3c6d9e2a5b8c1f4d7',
  ARRAY['alert.live', 'alert.extreme', 'intelligence.epidemic'],
  ARRAY['LAG-METRO', 'FCT-ABJ'],
  true,
  now() - interval '12 minutes',
  200
WHERE NOT EXISTS (SELECT 1 FROM public.developer_webhooks);

-- 8. PROVISION TEST DEVELOPER ACCOUNT (dev@acme.ng / SafeAlertDev2026!) ------
DO $$
DECLARE
  dev_uid UUID := 'de000001-2026-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dev@acme.ng') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      dev_uid,
      'authenticated',
      'authenticated',
      'dev@acme.ng',
      crypt('SafeAlertDev2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Tunde Bakare (Lead Developer)","agency":"Acme Logistics Nigeria Ltd","account_type":"developer"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      dev_uid,
      dev_uid::text,
      jsonb_build_object('sub', dev_uid::text, 'email', 'dev@acme.ng', 'email_verified', true, 'phone_verified', false),
      'email',
      now(), now(), now()
    );
  ELSE
    SELECT id INTO dev_uid FROM auth.users WHERE email = 'dev@acme.ng';
  END IF;

  INSERT INTO public.profiles (id, full_name, agency)
  VALUES (dev_uid, 'Tunde Bakare (Lead Developer)', 'Acme Logistics Nigeria Ltd')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, agency = EXCLUDED.agency;

  DELETE FROM public.user_roles WHERE user_id = dev_uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (dev_uid, 'developer') ON CONFLICT DO NOTHING;

  UPDATE public.developer_api_keys SET user_id = dev_uid WHERE user_id IS NULL;
  UPDATE public.developer_webhooks SET user_id = dev_uid WHERE user_id IS NULL;
END $$;

-- 9. PROVISION OFFICIAL OPERATOR ACCOUNT (operator@safealert.live / SafeAlert2026!)
DO $$
DECLARE
  op_uid UUID := '00000001-2026-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'operator@safealert.live') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      op_uid,
      'authenticated',
      'authenticated',
      'operator@safealert.live',
      crypt('SafeAlert2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"National Command Operator","agency":"SafeAlert Command Centre","account_type":"operator"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      op_uid,
      op_uid::text,
      jsonb_build_object('sub', op_uid::text, 'email', 'operator@safealert.live', 'email_verified', true, 'phone_verified', false),
      'email',
      now(), now(), now()
    );
  ELSE
    SELECT id INTO op_uid FROM auth.users WHERE email = 'operator@safealert.live';
    UPDATE auth.users
    SET encrypted_password = crypt('SafeAlert2026!', gen_salt('bf')),
        email_confirmed_at = now()
    WHERE id = op_uid;
  END IF;

  INSERT INTO public.profiles (id, full_name, agency)
  VALUES (op_uid, 'National Command Operator', 'SafeAlert Command Centre')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, agency = EXCLUDED.agency;

  INSERT INTO public.user_roles (user_id, role) VALUES (op_uid, 'admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (op_uid, 'operator') ON CONFLICT DO NOTHING;
END $$;

-- 10. ALLOW AUTONOMOUS LIVE INTEL ENGINE TO SYNC ALERTS AUTOMATICALLY --------
DROP POLICY IF EXISTS "alerts_autonomous_sync_insert" ON public.alerts;
CREATE POLICY "alerts_autonomous_sync_insert" ON public.alerts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "alerts_autonomous_sync_update" ON public.alerts;
CREATE POLICY "alerts_autonomous_sync_update" ON public.alerts
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "alert_zones_autonomous_sync" ON public.alert_zones;
CREATE POLICY "alert_zones_autonomous_sync" ON public.alert_zones
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "alert_deliveries_autonomous_sync" ON public.alert_deliveries;
CREATE POLICY "alert_deliveries_autonomous_sync" ON public.alert_deliveries
  FOR ALL USING (true) WITH CHECK (true);

-- 11. REMOVE LEGACY operator@safealert.gov AND ENSURE ONLY operator@safealert.live EXISTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'operator@safealert.gov') AND EXISTS (SELECT 1 FROM auth.users WHERE email = 'operator@safealert.live') THEN
    DELETE FROM auth.users WHERE email = 'operator@safealert.gov';
  ELSIF EXISTS (SELECT 1 FROM auth.users WHERE email = 'operator@safealert.gov') THEN
    UPDATE auth.users
    SET email = 'operator@safealert.live'
    WHERE email = 'operator@safealert.gov';
  END IF;

  UPDATE auth.identities
  SET identity_data = jsonb_set(identity_data, '{email}', '"operator@safealert.live"')
  WHERE identity_data->>'email' = 'operator@safealert.gov';
END $$;
