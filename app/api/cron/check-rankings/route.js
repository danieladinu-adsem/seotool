import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BATCH_SIZE = 200; // procesăm cât putem în 50s, time guard oprește înainte de timeout

export async function GET(request) {
  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const urlSecret = new URL(request.url).searchParams.get('secret');
  const secret = process.env.CRON_SECRET;
  if (headerSecret !== secret && bearerSecret !== secret && urlSecret !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  // Citește offset-ul curent
  const { data: stateRow } = await supabase
    .from('cron_state')
    .select('offset, last_date')
    .eq('id', 'check-rankings')
    .maybeSingle();

  // Dacă e o zi nouă, resetează offset-ul
  const savedDate = stateRow?.last_date;
  const currentOffset = (savedDate === today) ? (stateRow?.offset || 0) : 0;

  // Încarcă toate proiectele active
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, url, auto_check, location_code, se_domain');

  if (projError) {
    return Response.json({ error: 'Failed to load projects', details: projError }, { status: 500 });
  }

  // Aplatizează toate keywords active din toate proiectele
  const allTasks = [];
  for (const project of projects || []) {
    if (!project.url) continue;
    if (project.auto_check === false) continue;

    const { data: keywords } = await supabase
      .from('keywords')
      .select('id, keyword')
      .eq('project_id', project.id);

    for (const kw of keywords || []) {
      allTasks.push({ kw, project });
    }
  }

  const totalTasks = allTasks.length;
  const batch = allTasks.slice(currentOffset, currentOffset + BATCH_SIZE);
  const nextOffset = currentOffset + batch.length;
  const isDone = nextOffset >= totalTasks;

  const results = { updated: 0, errors: 0, details: [], offset: currentOffset, total: totalTasks, batch: batch.length };
  const startTime = Date.now();
  const MAX_MS = 50000; // stop after 50s to avoid timeout

  for (const { kw, project } of batch) {
    if (Date.now() - startTime > MAX_MS) {
      results.details.push({ status: 'timeout_guard', message: 'Stopped to avoid timeout' });
      break;
    }
    try {
      const resD = await fetch(`${baseUrl}/api/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kw.keyword,
          url: project.url,
          device: 'desktop',
          location_code: project.location_code || 2642,
          se_domain: project.se_domain || 'google.ro',
        }),
      });
      const dataD = await resD.json();
      const posDesktop = dataD.position ?? null;

      await supabase
        .from('keywords')
        .update({ position_desktop: posDesktop, position: posDesktop })
        .eq('id', kw.id);

      if (posDesktop != null) {
        await supabase.from('keyword_history').upsert(
          { keyword_id: kw.id, position: posDesktop, date: today },
          { onConflict: 'keyword_id,date' }
        );
      }

      results.updated++;
      results.details.push({ keyword: kw.keyword, status: 'ok', posDesktop });
    } catch (e) {
      results.errors++;
      results.details.push({ keyword: kw.keyword, status: 'error', error: e.message });
    }
  }

  // Salvează noul offset (sau resetează dacă am terminat tot)
  const newOffset = isDone ? 0 : nextOffset;
  await supabase
    .from('cron_state')
    .upsert({ id: 'check-rankings', offset: newOffset, last_date: today }, { onConflict: 'id' });

  console.log(`Cron: ${results.updated} ok, ${results.errors} erori, offset ${currentOffset}→${newOffset}/${totalTasks}`);
  return Response.json({ success: true, date: today, isDone, ...results });
}
