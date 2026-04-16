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

  // Apeluri paralele: dataforseo_labs/keyword_suggestions + keywords_for_keywords
  const [suggestionsRes, forKeywordsRes] = await Promise.allSettled([
    fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ ...baseParams, keyword: query, include_seed_keyword: true }]),
    }).then(r => r.json()),
    fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ ...baseParams, keywords: [query] }]),
    }).then(r => r.json()),
  ]);

  // dataforseo_labs items au volumul in keyword_info — normalizam la acelasi format
  const rawLabsItems =
    suggestionsRes.status === 'fulfilled'
      ? suggestionsRes.value?.tasks?.[0]?.result?.[0]?.items || []
      : [];
  const items1 = rawLabsItems.map(item => ({
    keyword: item.keyword,
    search_volume: item.keyword_info?.search_volume || 0,
    monthly_searches: item.keyword_info?.monthly_searches || [],
  }));

  // keywords_for_keywords: tasks[0].result (array direct, format deja corect)
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

  // Returnam in acelasi format ca inainte
  return Response.json({
    tasks: [{ result: merged }],
  });
}
