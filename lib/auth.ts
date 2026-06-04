import { createClient } from './supabase.server';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type UserStatus = 'pending' | 'approved' | 'rejected';
export type UserRole   = 'user' | 'superadmin';

export interface UserProfile {
  id:              string;
  company_name:    string;
  contact_name:    string;
  contact_email:   string;
  access_reason:   string | null;
  status:          UserStatus;
  role:            UserRole;
  approved_by:     string | null;
  approved_at:     string | null;
  rejected_reason: string | null;
  created_at:      string;
  updated_at:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side auth helpers (use in API routes and Server Components)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the currently authenticated Supabase user, or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Fetches the tamiz_user_profiles record for a given user id. */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tamiz_user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as UserProfile;
}

/** Returns true if the user is approved to access the questionnaire. */
export async function isApprovedUser(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.status === 'approved';
}

/** Returns true if the user has superadmin role. */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.role === 'superadmin';
}

/** Returns true if the given email matches the SUPERADMIN_EMAIL env var. */
export function isSuperAdminEmail(email: string): boolean {
  const adminEmail = process.env.SUPERADMIN_EMAIL || '';
  return adminEmail.trim().toLowerCase() === email.trim().toLowerCase();
}
