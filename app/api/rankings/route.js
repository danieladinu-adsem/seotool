export async function POST(request) {
  const { keyword, url, location_code, se_domain, device } = await request.json();

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
        se_domain: se_domain || 'google.ro',
        language_code: 'ro',
        device: device === 'mobile' ? 'mobile' : 'desktop',
        os: device === 'mobile' ? 'android' : 'windows',
        depth: 100,
      }]),
    }
  );

  const data = await response.json();

  const normalize = u => (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase().split('?')[0].split('#')[0];
  const urlNorm = normalize(url);
  const domain = urlNorm.split('/')[0];
  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  const organicItems = items.filter(item => item.type === 'organic' && item.url);

  // Încearcă mai întâi match exact (bidirecțional), apoi fallback pe domeniu
  let found = organicItems.find(item => {
    const itemNorm = normalize(item.url);
    return urlNorm && (itemNorm.includes(urlNorm) || urlNorm.includes(itemNorm));
  });
  if (!found && domain) {
    found = organicItems.find(item => normalize(item.url).startsWith(domain + '/') || normalize(item.url) === domain);
  }

  console.log('[rankings]', keyword, 'urlNorm:', urlNorm, 'found:', found ? `#${found.rank_absolute} ${found.url}` : 'null', 'organic items:', organicItems.length);

  return Response.json({
    position: found ? found.rank_absolute : null,
    url: found ? found.url : null,
    debug: { urlNorm, organicCount: organicItems.length, top5: organicItems.slice(0,5).map(i=>({url:i.url,rank:i.rank_absolute})) },
  });
}
