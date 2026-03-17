export async function POST(request) {
  const { keyword, url, location_code, device } = await request.json();
  
  const credentials = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  const response = await fetch(
    'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keyword: keyword,
        location_code: location_code || 2642,
        language_code: 'ro',
        device: device === 'mobile' ? 'mobile' : 'desktop',
        os: device === 'mobile' ? 'android' : 'windows',
        depth: 100,
      }]),
    }
  );

  const data = await response.json();
  
  // Gaseste pozitia site-ului in rezultate
  const normalize = u => (u || '').replace(/^https?:\/\//,'').replace(/^www\./,'').toLowerCase();
  const urlNorm = normalize(url);
  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  const found = items.find(item => urlNorm && normalize(item.url).includes(urlNorm));
  
  return Response.json({
    position: found ? found.rank_absolute : null,
    url: found ? found.url : null,
    raw: data
  });
}