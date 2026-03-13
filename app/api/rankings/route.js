export async function POST(request) {
  const { keyword, url, location_code } = await request.json();
  
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
        device: 'desktop',
        os: 'windows',
      }]),
    }
  );

  const data = await response.json();
  
  // Gaseste pozitia site-ului in rezultate
  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  const found = items.find(item => 
    item.url && url && item.url.includes(url.replace('https://','').replace('http://',''))
  );
  
  return Response.json({
    position: found ? found.rank_absolute : null,
    url: found ? found.url : null,
    raw: data
  });
}