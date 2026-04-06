import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DATAFORSEO_AUTH = () => Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64');

const extractDomain = u => (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().split('/')[0].split('?')[0].split('#')[0];
const domainMatch = (trackedDomain, serpUrl) => {
  const d = extractDomain(serpUrl);
  return d === trackedDomain || d.endsWith('.' + trackedDomain);
};

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
    const allWithUrl = items.filter(i => i.url);
    const trackedDomain = extractDomain(url);

    // Caută întâi în organice, apoi în toate
    let found = allWithUrl.find(i => i.type === 'organic' && domainMatch(trackedDomain, i.url));
    if (!found) found = allWithUrl.find(i => domainMatch(trackedDomain, i.url));

    return {
      pos: found ? (found.rank_group || found.rank_absolute) : null,
      organicCount: allWithUrl.filter(i => i.type === 'organic').length,
    };
  } catch (e) {
    return { pos: null, organicCount: 0, fetchError: e.message };
  }
}

const BATCH_SIZE = parseInt(process.env.CRON_BATCH_SIZE || '5');
const DELAY_MS = 300; // delay între cereri DataForSEO

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

  // Încarcă toate proiectele active
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, url, auto_check, location_code, se_domain');

  if (projError) {
    console.error('[cron] projects error:', projError);
    return Response.json({ error: 'Failed to load projects', details: projError }, { status: 500 });
  }

  // Aplatizează toate keywords active
  const allTasks = [];
  for (const project of projects || []) {
    if (!project.url) continue;
    if (project.auto_check === false) continue;

    const { data: keywords, error: kwError } = await supabase
      .from('keywords')
      .select('id, keyword')
      .eq('project_id', project.id);

    if (kwError) {
      console.error('[cron] keywords error pentru project', project.id, kwError);
      continue;
    }

    for (const kw of keywords || []) {
      allTasks.push({ kw, project });
    }
  }

  // Găsește keyword-urile deja verificate azi
  const { data: todayHistory, error: histError } = await supabase
    .from('keyword_history')
    .select('keyword_id')
    .eq('date', today);

  if (histError) {
    console.error('[cron] eroare citire history azi:', histError);
  }

  const checkedIds = new Set((todayHistory || []).map(h => String(h.keyword_id)));

  // Procesează DOAR keywords-urile care nu au fost încă verificate azi, max BATCH_SIZE
  const remaining = allTasks.filter(t => !checkedIds.has(String(t.kw.id)));
  const batch = remaining.slice(0, BATCH_SIZE);

  const results = {
    updated: 0,
    found: 0,
    notFound: 0,
    errors: 0,
    supabaseErrors: 0,
    skipped: checkedIds.size,
    total: allTasks.length,
    remaining: remaining.length,
    batchSize: batch.length,
    details: [],
  };

  for (const { kw, project } of batch) {
    try {
      const { pos, organicCount, fetchError } = await getRanking(kw.keyword, project.url, project.location_code, project.se_domain);

      if (fetchError) {
        results.errors++;
        results.details.push({ keyword: kw.keyword, status: 'fetch_error', error: fetchError });
        continue;
      }

      // Actualizează câmpul curent în keywords
      const { error: kwUpdateErr } = await supabase
        .from('keywords')
        .update({ position_desktop: pos, position: pos })
        .eq('id', kw.id);

      if (kwUpdateErr) {
        console.error('[cron] eroare update keyword', kw.keyword, kwUpdateErr);
        results.supabaseErrors++;
      }

      // Salvează în history întotdeauna (null = verificat dar negăsit în top 100)
      const { error: histUpsertErr } = await supabase
        .from('keyword_history')
        .upsert(
          { keyword_id: kw.id, position: pos, date: today },
          { onConflict: 'keyword_id,date' }
        );

      if (histUpsertErr) {
        console.error('[cron] eroare upsert history', kw.keyword, histUpsertErr);
        results.supabaseErrors++;
        results.details.push({ keyword: kw.keyword, status: 'history_error', error: histUpsertErr.message, code: histUpsertErr.code, pos });
      } else {
        results.updated++;
        if (pos != null) results.found++;
        else results.notFound++;
        results.details.push({ keyword: kw.keyword, status: 'ok', pos, organicCount });
      }

    } catch (e) {
      results.errors++;
      results.details.push({ keyword: kw.keyword, status: 'error', error: e.message });
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  const allDone = checkedIds.size + results.updated >= allTasks.length;
  console.log(`[cron] ${results.updated} salvate (${results.found} găsite, ${results.notFound} negăsite), ${checkedIds.size} deja ok, ${results.supabaseErrors} erori supabase, ${results.errors} erori`);
  return Response.json({ success: true, date: today, allDone, ...results });
}
