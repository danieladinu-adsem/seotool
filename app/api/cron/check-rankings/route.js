import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DATAFORSEO_AUTH = () => Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64');

const normalize = u => (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

async function getRanking(keyword, url, location_code, se_domain) {
  try {
    const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: { Authorization: `Basic ${DATAFORSEO_AUTH()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keyword,
        location_code: location_code || 2642,
        language_code: 'ro',
        se_domain: se_domain || 'google.ro',
        device: 'desktop',
        os: 'windows',
        depth: 100,
      }]),
    });
    const data = await res.json();
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];
    const normUrl = normalize(url);
    for (const item of items) {
      if (item.type === 'organic' && normalize(item.url).includes(normUrl)) {
        return item.rank_absolute ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

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

  // Citește offset-ul curent
  const { data: stateRow } = await supabase
    .from('cron_state')
    .select('"offset", last_date')
    .eq('id', 'check-rankings')
    .maybeSingle();

  const savedDate = stateRow?.last_date;
  const currentOffset = (savedDate === today) ? (stateRow?.offset || 0) : 0;

  // Încarcă toate proiectele active
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, url, auto_check, location_code, se_domain');

  if (projError) {
    return Response.json({ error: 'Failed to load projects', details: projError }, { status: 500 });
  }

  // Aplatizează toate keywords active
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
  const batch = allTasks.slice(currentOffset, currentOffset + 200);
  const results = { updated: 0, errors: 0, details: [], offset: currentOffset, total: totalTasks, batch: batch.length };
  const startTime = Date.now();
  const MAX_MS = 250000; // 4 minute (maxDuration e 300s)

  for (const { kw, project } of batch) {
    if (Date.now() - startTime > MAX_MS) {
      results.details.push({ status: 'timeout_guard', processed: results.updated + results.errors });
      break;
    }
    try {
      const pos = await getRanking(kw.keyword, project.url, project.location_code, project.se_domain);

      await supabase
        .from('keywords')
        .update({ position_desktop: pos, position: pos })
        .eq('id', kw.id);

      if (pos != null) {
        await supabase.from('keyword_history').upsert(
          { keyword_id: kw.id, position: pos, date: today },
          { onConflict: 'keyword_id,date' }
        );
      }

      results.updated++;
      results.details.push({ keyword: kw.keyword, status: 'ok', pos });
    } catch (e) {
      results.errors++;
      results.details.push({ keyword: kw.keyword, status: 'error', error: e.message });
    }
  }

  // Calculează noul offset
  const processed = results.updated + results.errors;
  const nextOffset = currentOffset + processed;
  const isDone = nextOffset >= totalTasks;
  const newOffset = isDone ? 0 : nextOffset;

  await supabase
    .from('cron_state')
    .upsert({ id: 'check-rankings', offset: newOffset, last_date: today }, { onConflict: 'id' });

  console.log(`Cron: ${results.updated} ok, ${results.errors} erori, offset ${currentOffset}→${newOffset}/${totalTasks}`);
  return Response.json({ success: true, date: today, isDone, ...results });
}
