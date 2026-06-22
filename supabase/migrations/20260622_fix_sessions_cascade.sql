-- Fix tamiz_sessions foreign key to allow user deletion (ON DELETE CASCADE)
ALTER TABLE tamiz_sessions DROP CONSTRAINT IF EXISTS tamiz_sessions_user_id_fkey;
ALTER TABLE tamiz_sessions ADD CONSTRAINT tamiz_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
