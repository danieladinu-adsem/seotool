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
  const task = data?.tasks?.[0];
  console.log('[rankings raw]', keyword, 'status:', task?.status_code, task?.status_message, 'result items:', task?.result?.[0]?.items?.length ?? 'no result');

  // Extrage domeniul de bază (fără protocol, www, path, query)
  const extractDomain = u => (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().split('/')[0].split('?')[0].split('#')[0];
  const trackedDomain = extractDomain(url);

  // Match: domeniu identic sau subdomeniu al domeniului tracked
  const domainMatch = serpUrl => {
    const d = extractDomain(serpUrl);
    return d === trackedDomain || d.endsWith('.' + trackedDomain);
  };

  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  const allWithUrl = items.filter(item => item.url);

  // Caută întâi în rezultatele organice, apoi în toate
  let found = allWithUrl.find(item => item.type === 'organic' && domainMatch(item.url));
  if (!found) found = allWithUrl.find(item => domainMatch(item.url));

  const position = found ? (found.rank_group || found.rank_absolute) : null;
  const domainMatches = allWithUrl.filter(i => domainMatch(i.url)).map(i => ({ url: i.url, type: i.type, rg: i.rank_group, ra: i.rank_absolute }));
  console.log('[rankings]', keyword, 'trackedDomain:', trackedDomain, 'found:', found ? `#${position}` : 'null', 'organicItems:', allWithUrl.filter(i=>i.type==='organic').length, 'domainMatches:', domainMatches.length);

  return Response.json({
    position,
    url: found ? found.url : null,
    debug: { urlNorm, totalWithUrl: allWithUrl.length, domainMatches },
  });
}
