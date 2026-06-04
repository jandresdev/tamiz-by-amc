-- =============================================================================
-- Tamiz Auth Migration — User Profiles + App Config
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla: tamiz_user_profiles
--    Perfil de cada usuario registrado, vinculado a auth.users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tamiz_user_profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name    TEXT        NOT NULL,
  contact_name    TEXT        NOT NULL,
  contact_email   TEXT        NOT NULL,
  access_reason   TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  role            TEXT        NOT NULL DEFAULT 'user'
                              CHECK (role IN ('user', 'superadmin')),
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  rejected_reason TEXT,
  last_seen       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 1b. Tabla: tamiz_access_requests
--    Solicitudes de acceso ANTES de que el admin apruebe e invite al usuario.
--    No requiere cuenta de auth — cualquiera puede enviar una solicitud.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tamiz_access_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name    TEXT        NOT NULL,
  company_name    TEXT        NOT NULL,
  contact_email   TEXT        NOT NULL,
  access_reason   TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  rejected_reason TEXT,
  invited_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único para evitar solicitudes duplicadas por email
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_email
  ON tamiz_access_requests(contact_email)
  WHERE status = 'pending';

-- ----------------------------------------------------------------------------
-- 2. Agregar user_id a tamiz_sessions (link cuestionario ↔ usuario auth)
-- ----------------------------------------------------------------------------
ALTER TABLE tamiz_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- ----------------------------------------------------------------------------
-- 3. Tabla: tamiz_app_config  (configuración gestionable desde SuperAdmin)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tamiz_app_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Valores por defecto
INSERT INTO tamiz_app_config (key, value, description) VALUES
  ('session_timeout_minutes', '30',
   'Minutos de inactividad antes de cerrar sesión del cuestionario'),
  ('ops_notification_email',  'ops@amcprincipal.com',
   'Email que recibe los diagnósticos enviados por usuarios'),
  ('max_verify_attempts',     '5',
   'Máximo de intentos fallidos de verificación OTP (legacy)'),
  ('legal_instructivo',
   'X es la empresa que se evalúa para efectos de determinar la categoría regulatoria en la cual opera.',
   'Texto del instructivo en el acordeón legal')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. RLS — tamiz_user_profiles
-- ----------------------------------------------------------------------------
ALTER TABLE tamiz_user_profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede leer y crear su propio perfil
CREATE POLICY "profile_select_own" ON tamiz_user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profile_insert_own" ON tamiz_user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Helper function to prevent infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tamiz_user_profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Superadmins tienen acceso completo a todos los perfiles
CREATE POLICY "profile_superadmin_all" ON tamiz_user_profiles
  FOR ALL USING (is_superadmin());

-- ----------------------------------------------------------------------------
-- 5. RLS — tamiz_app_config
-- ----------------------------------------------------------------------------
ALTER TABLE tamiz_app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_read_authenticated" ON tamiz_app_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "config_write_superadmin" ON tamiz_app_config
  FOR ALL USING (is_superadmin());

-- ----------------------------------------------------------------------------
-- 6. Índices de rendimiento
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_status   ON tamiz_user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_email    ON tamiz_user_profiles(contact_email);
CREATE INDEX IF NOT EXISTS idx_profiles_role     ON tamiz_user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id  ON tamiz_sessions(user_id);

-- ----------------------------------------------------------------------------
-- 7. Actualizar RLS de tamiz_sessions para usar user_id
--    (reemplaza las políticas permisivas existentes por seguridad basada en auth)
-- ----------------------------------------------------------------------------
-- Eliminar políticas antiguas permisivas
DROP POLICY IF EXISTS "Enable insert for authenticated users"  ON tamiz_sessions;
DROP POLICY IF EXISTS "Enable read for authenticated users"    ON tamiz_sessions;
DROP POLICY IF EXISTS "Enable update for authenticated users"  ON tamiz_sessions;

-- Nuevas políticas: el usuario solo accede a sus propias sesiones
CREATE POLICY "sessions_insert_own" ON tamiz_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "sessions_select_own" ON tamiz_sessions
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "sessions_update_own" ON tamiz_sessions
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "sessions_superadmin_all" ON tamiz_sessions
  FOR ALL USING (is_superadmin());
