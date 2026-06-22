-- =============================================================================
-- Migration: Security & Performance Hardening
-- Date: 2026-06-22
-- Applied to: boyagwflofwqjtdwwkfo (tamiz-nextjs)
--
-- Fixes:
--   1. SECURITY: Move is_superadmin() from public to private schema
--      so it's not callable via /rest/v1/rpc/is_superadmin but still
--      works inside RLS policies.
--   2. PERFORMANCE: Wrap auth.uid() in (select ...) for all RLS policies
--      to avoid per-row re-evaluation (InitPlan optimization)
-- =============================================================================

-- ─── 1. SECURITY: Move is_superadmin() to private schema ────────────────────

-- Create private schema (not exposed by PostgREST)
CREATE SCHEMA IF NOT EXISTS private;

-- Create the function in the private schema
CREATE OR REPLACE FUNCTION private.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tamiz_user_profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER
   SET search_path = public, pg_temp;

-- Grant EXECUTE to roles that need it for RLS evaluation
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO anon;
GRANT EXECUTE ON FUNCTION private.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_superadmin() TO anon;

-- Update ALL RLS policies to use private.is_superadmin()

-- tamiz_user_profiles
DROP POLICY IF EXISTS "profile_superadmin_all" ON tamiz_user_profiles;
CREATE POLICY "profile_superadmin_all" ON tamiz_user_profiles
  FOR ALL USING (private.is_superadmin());

-- tamiz_app_config
DROP POLICY IF EXISTS "config_write_superadmin" ON tamiz_app_config;
CREATE POLICY "config_write_superadmin" ON tamiz_app_config
  FOR ALL USING (private.is_superadmin());

-- tamiz_sessions
DROP POLICY IF EXISTS "sessions_superadmin_all" ON tamiz_sessions;
CREATE POLICY "sessions_superadmin_all" ON tamiz_sessions
  FOR ALL USING (private.is_superadmin());

-- tamiz_files
DROP POLICY IF EXISTS "files_superadmin_all" ON tamiz_files;
CREATE POLICY "files_superadmin_all" ON tamiz_files
  FOR ALL USING (private.is_superadmin());

-- tamiz_diagnosticos
DROP POLICY IF EXISTS "diagnosticos_superadmin_all" ON tamiz_diagnosticos;
CREATE POLICY "diagnosticos_superadmin_all" ON tamiz_diagnosticos
  FOR ALL USING (private.is_superadmin());

-- tamiz_access_requests
DROP POLICY IF EXISTS "access_requests_superadmin_all" ON tamiz_access_requests;
CREATE POLICY "access_requests_superadmin_all" ON tamiz_access_requests
  FOR ALL USING (private.is_superadmin());

-- storage.objects
DROP POLICY IF EXISTS "storage_superadmin_all" ON storage.objects;
CREATE POLICY "storage_superadmin_all" ON storage.objects
  FOR ALL USING (bucket_id = 'tamiz-files' AND private.is_superadmin());

-- Remove the old public function
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM public;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM authenticated;
DROP FUNCTION IF EXISTS public.is_superadmin();


-- ─── 2. PERFORMANCE: Wrap auth.uid() in (select ...) ────────────────────────

-- tamiz_user_profiles
DROP POLICY IF EXISTS "profile_select_own" ON tamiz_user_profiles;
CREATE POLICY "profile_select_own" ON tamiz_user_profiles
  FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profile_insert_own" ON tamiz_user_profiles;
CREATE POLICY "profile_insert_own" ON tamiz_user_profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- tamiz_app_config
DROP POLICY IF EXISTS "config_read_authenticated" ON tamiz_app_config;
CREATE POLICY "config_read_authenticated" ON tamiz_app_config
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

-- tamiz_sessions
DROP POLICY IF EXISTS "sessions_insert_own" ON tamiz_sessions;
CREATE POLICY "sessions_insert_own" ON tamiz_sessions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "sessions_select_own" ON tamiz_sessions;
CREATE POLICY "sessions_select_own" ON tamiz_sessions
  FOR SELECT USING ((select auth.uid()) = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "sessions_update_own" ON tamiz_sessions;
CREATE POLICY "sessions_update_own" ON tamiz_sessions
  FOR UPDATE USING ((select auth.uid()) = user_id OR user_id IS NULL);

-- tamiz_files
DROP POLICY IF EXISTS "files_select_own" ON tamiz_files;
CREATE POLICY "files_select_own" ON tamiz_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_files.session_id
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "files_insert_own" ON tamiz_files;
CREATE POLICY "files_insert_own" ON tamiz_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_files.session_id
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "files_update_own" ON tamiz_files;
CREATE POLICY "files_update_own" ON tamiz_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_files.session_id
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "files_delete_own" ON tamiz_files;
CREATE POLICY "files_delete_own" ON tamiz_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_files.session_id
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

-- tamiz_diagnosticos
DROP POLICY IF EXISTS "diagnosticos_select_own" ON tamiz_diagnosticos;
CREATE POLICY "diagnosticos_select_own" ON tamiz_diagnosticos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_diagnosticos.session_id
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "diagnosticos_insert_own" ON tamiz_diagnosticos;
CREATE POLICY "diagnosticos_insert_own" ON tamiz_diagnosticos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_diagnosticos.session_id
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "diagnosticos_update_own" ON tamiz_diagnosticos;
CREATE POLICY "diagnosticos_update_own" ON tamiz_diagnosticos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_diagnosticos.session_id
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

-- storage.objects
DROP POLICY IF EXISTS "storage_insert_own" ON storage.objects;
CREATE POLICY "storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tamiz-files'
    AND EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "storage_select_own" ON storage.objects;
CREATE POLICY "storage_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tamiz-files'
    AND EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS "storage_delete_own" ON storage.objects;
CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tamiz-files'
    AND EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND (s.user_id = (select auth.uid()) OR s.user_id IS NULL)
    )
  );
