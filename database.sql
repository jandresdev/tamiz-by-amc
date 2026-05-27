-- Tamiz Database Schema for Supabase PostgreSQL

-- Table: tamiz_sessions
CREATE TABLE IF NOT EXISTS tamiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  contact_email TEXT NOT NULL,
  current_step TEXT DEFAULT 'qName',
  email_verified BOOLEAN DEFAULT FALSE,
  verify_token TEXT,
  verify_expiry TIMESTAMP WITH TIME ZONE,
  verify_attempts INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  answers_json JSONB DEFAULT '{}',
  preliminary_scheme TEXT,
  active_schemes TEXT[] DEFAULT ARRAY['AUTOGEN', 'PMARG', 'SUMIN', 'VENTAEXC', 'SINSOP'],
  history_json JSONB DEFAULT '[]',
  files_json JSONB DEFAULT '{}',
  normativa_user_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(id)
);

-- Table: tamiz_files (for storing file metadata)
CREATE TABLE IF NOT EXISTS tamiz_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tamiz_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  supabase_path TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(id)
);

-- Table: tamiz_diagnosticos
CREATE TABLE IF NOT EXISTS tamiz_diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tamiz_sessions(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  initial_intuition TEXT,
  diagnosed_scheme TEXT,
  all_answers JSONB,
  sent_to_ops BOOLEAN DEFAULT FALSE,
  sent_to_user BOOLEAN DEFAULT FALSE,
  ops_response_id TEXT,
  user_response_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tamiz_sessions_email ON tamiz_sessions(contact_email);
CREATE INDEX IF NOT EXISTS idx_tamiz_sessions_current_step ON tamiz_sessions(current_step);
CREATE INDEX IF NOT EXISTS idx_tamiz_sessions_created_at ON tamiz_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_tamiz_files_session_id ON tamiz_files(session_id);
CREATE INDEX IF NOT EXISTS idx_tamiz_diagnosticos_session_id ON tamiz_diagnosticos(session_id);
CREATE INDEX IF NOT EXISTS idx_tamiz_diagnosticos_email ON tamiz_diagnosticos(contact_email);

-- Enable RLS (Row Level Security) for security
ALTER TABLE tamiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tamiz_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tamiz_diagnosticos ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (allow all for now, restrict later based on auth)
-- For tamiz_sessions
CREATE POLICY "Enable insert for authenticated users" ON tamiz_sessions
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Enable read for authenticated users" ON tamiz_sessions
  FOR SELECT USING (TRUE);

CREATE POLICY "Enable update for authenticated users" ON tamiz_sessions
  FOR UPDATE USING (TRUE);

-- For tamiz_files
CREATE POLICY "Enable all for authenticated users" ON tamiz_files
  FOR ALL USING (TRUE);

-- For tamiz_diagnosticos
CREATE POLICY "Enable all for authenticated users" ON tamiz_diagnosticos
  FOR ALL USING (TRUE);

-- Storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('tamiz-files', 'tamiz-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Enable authenticated uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tamiz-files');

CREATE POLICY "Enable authenticated reads" ON storage.objects
  FOR SELECT USING (bucket_id = 'tamiz-files');

CREATE POLICY "Enable authenticated deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'tamiz-files');
