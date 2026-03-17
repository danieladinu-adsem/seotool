import { Resend } from 'resend';

export async function POST(request) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: 'SEO Tool <onboarding@resend.dev>',
    to: ['daniela.dinu@adsem.ro', 'daniela.dinu1312@yahoo.com'],
    subject: 'Parola SEO Tool',
    text: 'Parola ta este: Parolaseotool13122012.',
  });

  if (error) {
    console.error('[send-password] Resend error:', JSON.stringify(error));
    return Response.json({ ok: false, error }, { status: 500 });
  }

  console.log('[send-password] trimis ok, id:', data?.id);
  return Response.json({ ok: true, id: data?.id });
}
