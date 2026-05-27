// ============================================================================
// email.ts — Tamiz v2.1
//
// El envío del diagnóstico a ops@amcprincipal.com se realiza desde la
// Supabase Edge Function "send-diagnostic" (supabase/functions/send-diagnostic/).
//
// La verificación OTP sigue siendo 100% Supabase Auth.
// ============================================================================

// Este archivo se mantiene como placeholder.
// Toda la lógica de email está en:
//   - OTP:        Supabase Auth (signInWithOtp / verifyOtp)
//   - Diagnóstico: supabase/functions/send-diagnostic/index.ts (SMTP via nodemailer)
export {};
