export async function POST(request) {
  try {
    const { query } = await request.json();
    const q = (query || '').toLowerCase().trim();
    if (!q) return Response.json({ topics: [] });

    const credentials = Buffer.from(
      `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
    ).toString('base64');

    const response = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keywords: [q],
          location_code: 2642,
          language_code: 'ro',
          limit: 200,
        }]),
      }
    );

    const data = await response.json();

    const task = data?.tasks?.[0];
    console.log('[blogtopics] status_code:', task?.status_code, '| status_message:', task?.status_message);
    console.log('[blogtopics] result count:', task?.result?.length ?? 'null');

    const items = task?.result || [];
    const queryWords = q.split(' ').filter(Boolean);

    const topics = items
      .map(item => {
        const kw = (item.keyword || '').toLowerCase();
        const vol = item.search_volume ?? 0;
        const isDirect = queryWords.every(w => kw.includes(w));
        return {
          topic: item.keyword,
          volume: vol,
          type: isDirect ? 'direct' : 'related',
        };
      })
      .filter(t => t.volume > 0)
      .sort((a, b) => b.volume - a.volume);

    return Response.json({ topics });
  } catch (e) {
    console.error('[blogtopics] error:', e.message);
    return Response.json({ topics: [], error: e.message }, { status: 500 });
  }
}
