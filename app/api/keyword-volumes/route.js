export async function POST(request) {
  const { keywords } = await request.json();
  if (!keywords?.length) return Response.json({ volumes: {} });

  const credentials = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  try {
    const res = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keywords, location_code: 2642, language_code: 'ro' }]),
      }
    );
    const data = await res.json();
    const items = data?.tasks?.[0]?.result || [];
    const volumes = {};
    for (const item of items) {
      if (item.keyword) volumes[item.keyword.toLowerCase()] = item.search_volume ?? 0;
    }
    return Response.json({ volumes });
  } catch (e) {
    console.error('[keyword-volumes] error:', e.message);
    return Response.json({ volumes: {} });
  }
}
