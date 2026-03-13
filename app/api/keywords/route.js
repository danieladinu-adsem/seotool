export async function POST(request) {
  const { keywords } = await request.json();
  const query = keywords[0].toLowerCase().trim();

  const credentials = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64');

  // Endpoint care gaseste automat toate variatiile similare
  const response = await fetch(
    'https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live',
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keywords: [query],
        location_code: 2642,
        language_code: 'ro',
        limit: 200,
      }]),
    }
  );

  const data = await response.json();
  return Response.json(data);
}