import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DATAFORSEO_AUTH = () => Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64');

const normalize = u => (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase().split('?')[0].split('#')[0];

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
    const organicItems = items.filter(i => i.type === 'organic' && i.url);
    const normUrl = normalize(url);
    const domain = normUrl.split('/')[0];

    let found = organicItems.find(item => {
      const n = normalize(item.url);
      return n.includes(normUrl) || normUrl.includes(n);
    });
    if (!found && domain) {
      found = organicItems.find(item => {
        const n = normalize(item.url);
        return n.startsWith(domain + '/') || n === domain;
      });
    }
    return found ? (found.rank_group || found.rank_absolute) : null;
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

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const dayOfMonth = now.getUTCDate();

  // Găsește proiectele cu raportare lunară activă pentru ziua de azi
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, name, url, location_code, se_domain, monthly_report_day')
    .eq('monthly_report', true)
    .eq('monthly_report_day', dayOfMonth);

  if (projError) {
    console.error('[monthly-report] projects error:', projError);
    return Response.json({ error: 'Failed to load projects', details: projError }, { status: 500 });
  }

  if (!projects?.length) {
    return Response.json({ success: true, date: today, dayOfMonth, message: 'Niciun proiect cu raportare lunară pentru ziua de azi', checked: 0 });
  }

  const results = { date: today, dayOfMonth, projects: [], totalChecked: 0, totalErrors: 0 };

  for (const project of projects) {
    if (!project.url) continue;

    const { data: keywords, error: kwError } = await supabase
      .from('keywords')
      .select('id, keyword')
      .eq('project_id', project.id);

    if (kwError) {
      console.error('[monthly-report] keywords error:', project.id, kwError);
      results.projects.push({ name: project.name, error: kwError.message });
      continue;
    }

    const projResult = { name: project.name, checked: 0, errors: 0, keywords: [] };

    for (const kw of keywords || []) {
      try {
        const pos = await getRanking(kw.keyword, project.url, project.location_code, project.se_domain);

        const { error: kwUpdateErr } = await supabase
          .from('keywords')
          .update({ position_desktop: pos, position: pos })
          .eq('id', kw.id);

        if (kwUpdateErr) console.error('[monthly-report] update keyword error:', kw.keyword, kwUpdateErr);

        const { error: histErr } = await supabase
          .from('keyword_history')
          .upsert(
            { keyword_id: kw.id, position: pos, date: today },
            { onConflict: 'keyword_id,date' }
          );

        if (histErr) {
          console.error('[monthly-report] history upsert error:', kw.keyword, histErr);
          projResult.errors++;
          results.totalErrors++;
        } else {
          projResult.checked++;
          results.totalChecked++;
        }
        projResult.keywords.push({ keyword: kw.keyword, pos });
      } catch (e) {
        projResult.errors++;
        results.totalErrors++;
        console.error('[monthly-report] error la keyword:', kw.keyword, e.message);
      }
    }

    results.projects.push(projResult);
  }

  console.log(`[monthly-report] ziua ${dayOfMonth}: ${results.totalChecked} keywords verificate, ${results.totalErrors} erori`);
  return Response.json({ success: true, ...results });
}
