export async function POST(request) {
  const { keywords } = await request.json();
  
  const credentials = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  const response = await fetch(
    'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keywords: keywords,
        location_code: 2642,
        language_code: 'ro',
      }]),
    }
  );

  const data = await response.json();
  return Response.json(data);
}