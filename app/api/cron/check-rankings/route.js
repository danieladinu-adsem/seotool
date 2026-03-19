import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const urlSecret = new URL(request.url).searchParams.get('secret');
  const secret = process.env.CRON_SECRET;
  if (headerSecret !== secret && bearerSecret !== secret && urlSecret !== secret) {
    console.error('[cron] Unauthorized. Headers received:', Object.fromEntries(request.headers));
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const results = { updated: 0, errors: 0, details: [] };

  // Încarcă toate proiectele
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, url');

  if (projError) {
    console.error('Cron: eroare la încărcarea proiectelor:', JSON.stringify(projError));
    return Response.json({ error: 'Failed to load projects', details: projError }, { status: 500 });
  }

  for (const project of projects || []) {
    if (!project.url) continue;

    // Încarcă keywords pentru proiect
    const { data: keywords, error: kwError } = await supabase
      .from('keywords')
      .select('id, keyword')
      .eq('project_id', project.id);

    if (kwError) {
      console.error(`Cron: eroare keywords pentru proiect ${project.id}:`, JSON.stringify(kwError));
      results.errors++;
      continue;
    }

    for (const kw of keywords || []) {
      try {
        // Verifică desktop
        const resD = await fetch(`${baseUrl}/api/rankings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw.keyword, url: project.url, device: 'desktop' }),
        });
        const dataD = await resD.json();
        const posDesktop = dataD.position ?? null;

        await new Promise(r => setTimeout(r, 200));

        // Verifică mobile
        const resM = await fetch(`${baseUrl}/api/rankings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw.keyword, url: project.url, device: 'mobile' }),
        });
        const dataM = await resM.json();
        const posMobile = dataM.position ?? null;

        // Poziție generică = desktop (pentru history/grafic)
        const position = posDesktop ?? posMobile ?? null;

        // Actualizează position_desktop, position_mobile și position în keywords
        const { error: updateError } = await supabase
          .from('keywords')
          .update({ position_desktop: posDesktop, position_mobile: posMobile, position })
          .eq('id', kw.id);

        if (updateError) {
          const msg = `update keyword failed: ${JSON.stringify(updateError)}`;
          console.error(`Cron: ${msg}`);
          results.errors++;
          results.details.push({ keyword: kw.keyword, project_url: project.url, status: 'error', error: msg });
          continue;
        }

        // Salvează în keyword_history (upsert pe date)
        const { data: existing } = await supabase
          .from('keyword_history')
          .select('id')
          .eq('keyword_id', kw.id)
          .eq('date', today)
          .maybeSingle();

        if (existing) {
          await supabase.from('keyword_history').update({ position }).eq('id', existing.id);
        } else if (position != null) {
          await supabase.from('keyword_history').insert({ keyword_id: kw.id, position, date: today });
        }

        results.updated++;
        results.details.push({ keyword: kw.keyword, project_url: project.url, status: 'ok', posDesktop, posMobile });

        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(`Cron: eroare la procesarea keyword ${kw.keyword}:`, e.message);
        results.errors++;
        results.details.push({ keyword: kw.keyword, project_url: project.url, status: 'error', error: e.message });
      }
    }
  }

  console.log(`Cron check-rankings finalizat: ${results.updated} actualizate, ${results.errors} erori`);
  return Response.json({ success: true, date: today, ...results });
}
