// ============================================================================
// Supabase Edge Function: send-otp
//
// Envía el código de verificación de 6 dígitos al correo del usuario
// mediante SMTP (nodemailer). Usa los mismos secrets SMTP que send-diagnostic.
//
// Variables requeridas (compartidas con send-diagnostic):
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
// ============================================================================

import nodemailer from 'npm:nodemailer@6';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { email, token, companyName } = await req.json() as {
      email: string;
      token: string;
      companyName: string;
    };

    if (!email || !token) {
      return json({ ok: false, error: 'Faltan campos: email, token' }, 400);
    }

    const transporter = nodemailer.createTransport({
      host:   Deno.env.get('SMTP_HOST'),
      port:   Number(Deno.env.get('SMTP_PORT') ?? '587'),
      secure: Deno.env.get('SMTP_SECURE') === 'true',
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    const html = buildOtpHtml({ email, token, companyName: companyName ?? '' });

    await transporter.sendMail({
      from:    `Tamiz AMC Principal <${Deno.env.get('SMTP_FROM') ?? 'noreply@amcprincipal.com'}>`,
      to:      email,
      subject: `${token} — Tu código de verificación Tamiz`,
      html,
    });

    return json({ ok: true });

  } catch (err) {
    console.error('[send-otp] Error:', err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

// ── Helper ───────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── Plantilla HTML del OTP ───────────────────────────────────────────────────
function buildOtpHtml(p: { email: string; token: string; companyName: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Código de verificación Tamiz</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.09);">

  <!-- Header -->
  <tr>
    <td style="background:#4A41B2;padding:28px 36px;">
      <p style="margin:0;color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">AMC PRINCIPAL</p>
      <p style="margin:5px 0 0;color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Verificación de correo</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:36px 36px 28px;">
      <p style="margin:0 0 8px;color:#5F5C56;font-size:14px;line-height:1.5;">
        ${p.companyName ? `Hola, estás verificando el correo para <strong style="color:#18171A;">${esc(p.companyName)}</strong>.` : 'Ingresa el siguiente código para continuar con tu diagnóstico.'}
      </p>
      <p style="margin:0 0 28px;color:#5F5C56;font-size:13px;">
        Ingresa este código en la pantalla de verificación:
      </p>

      <!-- Código OTP grande -->
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#ECEAFB;border-radius:12px;margin-bottom:24px;">
        <tr>
          <td align="center" style="padding:28px 20px;">
            <p style="margin:0;color:#4A41B2;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Tu código de verificación</p>
            <p style="margin:0;font-size:42px;font-weight:900;letter-spacing:10px;color:#18171A;font-family:monospace;">${esc(p.token)}</p>
          </td>
        </tr>
      </table>

      <p style="margin:0;color:#A09C94;font-size:12px;line-height:1.6;">
        Este código expira en <strong>10 minutos</strong> y es de un solo uso.<br>
        Si no solicitaste este código, puedes ignorar este correo.
      </p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#F5F4F0;padding:18px 36px;border-top:1px solid #EDEAE0;">
      <p style="margin:0;color:#A09C94;font-size:11px;">Tamiz es una herramienta propietaria de AMC Principal. Uso confidencial.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}
