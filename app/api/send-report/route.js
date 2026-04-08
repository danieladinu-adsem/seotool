import { Resend } from 'resend';

export async function POST(request) {
  try {
    const { to, subject, message, reportHtml } = await request.json();

    if (!to || !subject || !reportHtml) {
      return Response.json(
        { error: 'Lipsesc câmpuri obligatorii: to, subject, reportHtml' },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return Response.json(
        { error: 'RESEND_API_KEY lipsește din variabilele de mediu' },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const htmlBody = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Inter, 'Segoe UI', sans-serif; color: #1A2B4A; margin: 0; padding: 24px; }
      .message { background: #F5F6F8; border-left: 4px solid #FF6B2B; padding: 14px 18px; margin-bottom: 24px; font-size: 14px; line-height: 1.6; border-radius: 4px; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E5EA; font-size: 11px; color: #8A94A6; }
    </style>
  </head>
  <body>
    ${message ? `<div class="message">${message}</div>` : ''}
    ${reportHtml}
    <div class="footer">Generat de SEO Tool by AdSem · ${new Date().toLocaleDateString('ro-RO')}</div>
  </body>
</html>`;

    const fromAddress = process.env.RESEND_FROM || 'noreply@adsem.ro';

    const { data, error } = await resend.emails.send({
      from: `SEO Tool <${fromAddress}>`,
      to,
      subject,
      html: htmlBody,
    });

    if (error) {
      console.error('Resend error:', JSON.stringify(error));
      const msg = error.message || 'Eroare la trimitere';
      const hint = fromAddress === 'onboarding@resend.dev'
        ? ' (domeniu implicit Resend — poate trimite doar la emailul contului Resend. Adaugă RESEND_FROM cu un domeniu verificat în Vercel.)'
        : '';
      return Response.json({ error: msg + hint }, { status: 500 });
    }

    return Response.json({ success: true, id: data?.id });
  } catch (e) {
    console.error('Send report exception:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
