export async function POST(request) {
  const { keywords, location_code, language_code } = await request.json();
  const query = keywords[0].toLowerCase().trim();

  const credentials = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  const headers = {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
  };

  const baseParams = {
    location_code: location_code || 2642,
    language_code: language_code || 'ro',
    limit: 1000,
  };

  // Apeluri paralele: keyword_suggestions + keywords_for_keywords
  const [suggestionsRes, forKeywordsRes] = await Promise.allSettled([
    fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keyword_suggestions/live', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ ...baseParams, keyword: query }]),
    }).then(r => r.json()),
    fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ ...baseParams, keywords: [query] }]),
    }).then(r => r.json()),
  ]);

  // DEBUG - sterge dupa diagnosticare
  const sVal = suggestionsRes.status === 'fulfilled' ? suggestionsRes.value : null;
  const fVal = forKeywordsRes.status === 'fulfilled' ? forKeywordsRes.value : null;
  console.log('[keywords] suggestions raw:', JSON.stringify(sVal).slice(0, 800));
  console.log('[keywords] forKeywords status:', forKeywordsRes.status);
  console.log('[keywords] forKeywords task status:', fVal?.tasks?.[0]?.status_code, fVal?.tasks?.[0]?.status_message);
  console.log('[keywords] forKeywords result count:', fVal?.tasks?.[0]?.result?.length ?? 'n/a');

  // keyword_suggestions: tasks[0].result[0].items
  // keywords_for_keywords: tasks[0].result (array direct)
  const items1 =
    suggestionsRes.status === 'fulfilled'
      ? suggestionsRes.value?.tasks?.[0]?.result?.[0]?.items || []
      : [];
  const items2 =
    forKeywordsRes.status === 'fulfilled'
      ? forKeywordsRes.value?.tasks?.[0]?.result || []
      : [];

  // Merge + dedup dupa keyword (keyword_suggestions are prioritate)
  const seen = new Map();
  for (const item of [...items1, ...items2]) {
    const key = item.keyword?.toLowerCase();
    if (key && !seen.has(key)) seen.set(key, item);
  }

  const merged = Array.from(seen.values());
  console.log('[keywords] items1 count:', items1.length, '| items2 count:', items2.length, '| merged:', merged.length);

  // Returnam in acelasi format ca inainte
  return Response.json({
    tasks: [{ result: merged }],
  });
}
