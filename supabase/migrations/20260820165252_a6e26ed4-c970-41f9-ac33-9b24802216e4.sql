-- ROLES ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  agency TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_issue(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','operator'))
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, agency)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'agency')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ZONES ---------------------------------------------------------------
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT,
  population_estimate BIGINT NOT NULL DEFAULT 0,
  centre_lat DOUBLE PRECISION,
  centre_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones_public_read" ON public.zones FOR SELECT USING (true);
CREATE POLICY "zones_admin_write" ON public.zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ALERTS --------------------------------------------------------------
CREATE TYPE public.hazard_type AS ENUM ('flood','heatwave','security_threat','epidemic','other');
CREATE TYPE public.alert_severity AS ENUM ('advisory','watch','warning','extreme');
CREATE TYPE public.alert_status AS ENUM ('draft','pending_approval','broadcasting','live','expired','cancelled');
CREATE TYPE public.channel_kind AS ENUM ('cell_broadcast','sms','satellite','wifi_push','siren');
CREATE TYPE public.delivery_status AS ENUM ('queued','dispatched','delivered','failed');

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard public.hazard_type NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'warning',
  status public.alert_status NOT NULL DEFAULT 'draft',
  headline TEXT NOT NULL,
  message TEXT NOT NULL,
  instructions TEXT,
  languages TEXT[] NOT NULL DEFAULT ARRAY['en'],
  siren_enabled BOOLEAN NOT NULL DEFAULT true,
  evacuation_map_url TEXT,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alerts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_public_read_live" ON public.alerts FOR SELECT USING (status IN ('live','broadcasting','expired'));
CREATE POLICY "alerts_staff_read_all" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "alerts_issue" ON public.alerts FOR INSERT TO authenticated WITH CHECK (public.can_issue(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "alerts_update" ON public.alerts FOR UPDATE TO authenticated USING (public.can_issue(auth.uid())) WITH CHECK (public.can_issue(auth.uid()));
CREATE POLICY "alerts_delete_admin" ON public.alerts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER alerts_updated_at BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.alert_zones (
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  PRIMARY KEY (alert_id, zone_id)
);
GRANT SELECT ON public.alert_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_zones TO authenticated;
GRANT ALL ON public.alert_zones TO service_role;
ALTER TABLE public.alert_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_zones_public_read" ON public.alert_zones FOR SELECT USING (true);
CREATE POLICY "alert_zones_write" ON public.alert_zones FOR ALL TO authenticated
  USING (public.can_issue(auth.uid())) WITH CHECK (public.can_issue(auth.uid()));

CREATE TABLE public.channel_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.channel_kind NOT NULL,
  name TEXT NOT NULL,
  operator_name TEXT,
  protocol TEXT NOT NULL,
  endpoint TEXT,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  health TEXT NOT NULL DEFAULT 'unknown',
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.channel_gateways TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_gateways TO authenticated;
GRANT ALL ON public.channel_gateways TO service_role;
ALTER TABLE public.channel_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gateways_public_read" ON public.channel_gateways FOR SELECT USING (true);
CREATE POLICY "gateways_admin_write" ON public.channel_gateways FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  gateway_id UUID REFERENCES public.channel_gateways(id) ON DELETE SET NULL,
  channel public.channel_kind NOT NULL,
  status public.delivery_status NOT NULL DEFAULT 'queued',
  devices_targeted BIGINT NOT NULL DEFAULT 0,
  devices_reached BIGINT NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  gateway_reference TEXT,
  error_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.alert_deliveries TO authenticated;
GRANT ALL ON public.alert_deliveries TO service_role;
ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries_staff_read" ON public.alert_deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "deliveries_staff_write" ON public.alert_deliveries FOR INSERT TO authenticated WITH CHECK (public.can_issue(auth.uid()));
CREATE POLICY "deliveries_staff_update" ON public.alert_deliveries FOR UPDATE TO authenticated
  USING (public.can_issue(auth.uid())) WITH CHECK (public.can_issue(auth.uid()));

CREATE TABLE public.alert_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  zone_code TEXT,
  device_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.alert_acknowledgements TO anon;
GRANT SELECT, INSERT ON public.alert_acknowledgements TO authenticated;
GRANT ALL ON public.alert_acknowledgements TO service_role;
ALTER TABLE public.alert_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acks_public_insert" ON public.alert_acknowledgements FOR INSERT WITH CHECK (true);
CREATE POLICY "acks_staff_read" ON public.alert_acknowledgements FOR SELECT TO authenticated USING (true);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_staff_read" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_staff_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_deliveries;

-- SEED ----------------------------------------------------------------
INSERT INTO public.zones (code, name, region, population_estimate, centre_lat, centre_lng) VALUES
  ('LAG-METRO', 'Lagos Metropolitan', 'Lagos', 15400000, 6.5244, 3.3792),
  ('FCT-ABJ', 'Abuja Federal Capital', 'FCT', 3800000, 9.0765, 7.3986),
  ('KAN-NORTH', 'Kano North Corridor', 'Kano', 4100000, 12.0022, 8.5920),
  ('RIV-DELTA', 'Rivers Delta Basin', 'Rivers', 2300000, 4.8156, 7.0498);

INSERT INTO public.channel_gateways (channel, name, operator_name, protocol, endpoint, region, health, last_heartbeat_at) VALUES
  ('cell_broadcast', 'National CBC Primary', 'MTN Nigeria', '3GPP CBS / CMAS over CBCP', 'cbc://cbc-primary.nema.gov/api', 'National', 'healthy', now()),
  ('cell_broadcast', 'National CBC Secondary', 'Airtel Nigeria', '3GPP CBS / CMAS over CBCP', 'cbc://cbc-secondary.nema.gov/api', 'National', 'healthy', now()),
  ('sms', 'Bulk SMSC Gateway', 'Glo Mobile', 'SMPP 3.4', 'smpp://smsc.glo.ng:2775', 'National', 'healthy', now()),
  ('satellite', 'GEO L-Band Broadcast', 'Inmarsat', 'BGAN / L-band alert carousel', 'https://gateway.satellite-partner.example/v1/broadcast', 'National', 'healthy', now()),
  ('satellite', 'LEO Direct-to-Device', 'Starlink D2D', '3GPP NTN NB-IoT direct-to-cell', 'https://ntn.satellite-partner.example/v1/d2d', 'Rural', 'degraded', now()),
  ('wifi_push', 'Public Wi-Fi Captive Push', 'NigComSat', 'Captive portal + WebPush', 'https://wifi-push.nema.gov/v1/push', 'Metro', 'healthy', now()),
  ('siren', 'Municipal Siren Grid', 'NEMA', 'IP siren control (SIP/RTP)', 'sip://sirens.nema.gov', 'Metro', 'healthy', now());

INSERT INTO public.alerts (hazard, severity, status, headline, message, instructions, languages, effective_at, expires_at)
VALUES
  ('heatwave', 'extreme', 'live', 'Severe Heatwave Warning',
   'Extreme heat danger across the Kano North corridor. Temperatures above 44 degrees expected for the next 48 hours.',
   'Stay indoors between 11:00 and 16:00. Drink water frequently. Check on elderly neighbours.',
   ARRAY['en','ha'], now() - interval '2 hours', now() + interval '46 hours'),
  ('flood', 'warning', 'expired', 'Flash Flood Warning - Delta Basin',
   'Rising water levels along the Rivers Delta basin. Low-lying communities should prepare to move to higher ground.',
   'Move to designated evacuation centres. Avoid crossing flooded roads.',
   ARRAY['en'], now() - interval '9 days', now() - interval '7 days');

INSERT INTO public.alert_zones (alert_id, zone_id)
SELECT a.id, z.id FROM public.alerts a, public.zones z
WHERE (a.hazard = 'heatwave' AND z.code = 'KAN-NORTH') OR (a.hazard = 'flood' AND z.code = 'RIV-DELTA');

INSERT INTO public.alert_deliveries (alert_id, zone_id, gateway_id, channel, status, devices_targeted, devices_reached, latency_ms, gateway_reference)
SELECT a.id, az.zone_id, g.id, g.channel, 'delivered',
  z.population_estimate, (z.population_estimate * 0.94)::bigint, 800 + (random()*2200)::int,
  'REF-' || upper(substr(md5(random()::text), 1, 10))
FROM public.alerts a
JOIN public.alert_zones az ON az.alert_id = a.id
JOIN public.zones z ON z.id = az.zone_id
JOIN public.channel_gateways g ON g.is_active;