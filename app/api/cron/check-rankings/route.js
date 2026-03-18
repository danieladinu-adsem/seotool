import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const headerSecret = request.headers.get('x-cron-secret');
  const urlSecret = new URL(request.url).searchParams.get('secret');
  if (headerSecret !== process.env.CRON_SECRET && urlSecret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seotool.vercel.app';

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
        // Obține poziția curentă de la DataForSEO
        const res = await fetch(`${baseUrl}/api/rankings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw.keyword, url: project.url }),
        });

        const data = await res.json();
        const position = data.position ?? 100;

        // Actualizează poziția curentă în tabelul keywords
        const { error: updateError } = await supabase
          .from('keywords')
          .update({ position })
          .eq('id', kw.id);

        if (updateError) {
          const msg = `update keyword failed: ${JSON.stringify(updateError)}`;
          console.error(`Cron: ${msg}`);
          results.errors++;
          results.details.push({ keyword: kw.keyword, project_url: project.url, status: 'error', error: msg });
          continue;
        }

        // Salvează în keyword_history
        const { error: histError } = await supabase
          .from('keyword_history')
          .insert({ keyword_id: kw.id, position, date: today });

        if (histError) {
          const msg = `history insert failed: ${JSON.stringify(histError)}`;
          console.error(`Cron: ${msg}`);
          results.errors++;
          results.details.push({ keyword: kw.keyword, project_url: project.url, status: 'error', error: msg });
          continue;
        }

        results.updated++;
        results.details.push({ keyword: kw.keyword, project_url: project.url, status: 'ok', position });
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
