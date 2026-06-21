-- =============================================================================
-- Tamiz RLS Hardening — tamiz_files, tamiz_diagnosticos, storage.objects
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- database.sql created tamiz_files / tamiz_diagnosticos / storage.objects with
-- "USING (TRUE)" policies (placeholder for the auth-less prototype).
-- database_migration_auth.sql later tightened tamiz_sessions to owner-only
-- access but never updated these dependent tables — any authenticated user
-- could read/write/delete every other user's files, diagnostics and uploaded
-- documents. This migration closes that gap using the same ownership model
-- (auth.uid() = tamiz_sessions.user_id, or user_id IS NULL for legacy/pre-auth
-- sessions), plus a superadmin bypass via the existing is_superadmin() helper.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. tamiz_files — scope by parent session ownership
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all for authenticated users" ON tamiz_files;

CREATE POLICY "files_select_own" ON tamiz_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_files.session_id
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "files_insert_own" ON tamiz_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_files.session_id
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "files_update_own" ON tamiz_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_files.session_id
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "files_delete_own" ON tamiz_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_files.session_id
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "files_superadmin_all" ON tamiz_files
  FOR ALL USING (is_superadmin());

-- ----------------------------------------------------------------------------
-- 2. tamiz_diagnosticos — scope by parent session ownership
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all for authenticated users" ON tamiz_diagnosticos;

CREATE POLICY "diagnosticos_select_own" ON tamiz_diagnosticos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_diagnosticos.session_id
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "diagnosticos_insert_own" ON tamiz_diagnosticos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_diagnosticos.session_id
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "diagnosticos_update_own" ON tamiz_diagnosticos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id = tamiz_diagnosticos.session_id
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "diagnosticos_superadmin_all" ON tamiz_diagnosticos
  FOR ALL USING (is_superadmin());

-- ----------------------------------------------------------------------------
-- 3. storage.objects (bucket 'tamiz-files') — scope by session ownership
--    Path layout: sessions/{sessionId}/{stepKey}/{timestamp}-{filename}
--    so (storage.foldername(name))[2] is the sessionId segment.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated reads"   ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated deletes" ON storage.objects;

CREATE POLICY "storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tamiz-files'
    AND EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "storage_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tamiz-files'
    AND EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tamiz-files'
    AND EXISTS (
      SELECT 1 FROM tamiz_sessions s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND (s.user_id = auth.uid() OR s.user_id IS NULL)
    )
  );

CREATE POLICY "storage_superadmin_all" ON storage.objects
  FOR ALL USING (bucket_id = 'tamiz-files' AND is_superadmin());

-- NOTE: the Edge Functions (send-diagnostic, send-otp) and the SuperAdmin API
-- routes use the SUPABASE_SERVICE_ROLE_KEY client, which bypasses RLS
-- entirely — they are unaffected by this migration.
