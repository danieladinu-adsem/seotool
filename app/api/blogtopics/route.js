export async function POST(request) {
  try {
    const { query } = await request.json();
    const q = (query || '').trim();
    if (!q) return Response.json({ topics: [] });

    // 1. Generează keywords conexe cu Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Ești un expert SEO. Pentru subiectul "${q}", generează 40 de subiecte/keywords din același domeniu pe care același public țintă le-ar căuta pe Google. Nu include variații ale cuvântului "${q}" ci subiecte complet diferite dar din același domeniu. Returnează DOAR un array JSON cu keywords, fără explicații. Exemplu pentru "asigurare auto": ["parcare laterala", "preschimbare permis auto", "contract vanzare cumparare auto", "itp auto", "amenzi rutiere"]`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData?.content?.[0]?.text || '[]';

    let keywords = [];
    try {
      const match = rawText.match(/\[[\s\S]*\]/);
      keywords = match ? JSON.parse(match[0]) : [];
    } catch {
      console.error('[blogtopics] eroare parsare JSON Claude:', rawText);
      return Response.json({ topics: [], error: 'Eroare parsare răspuns Claude' }, { status: 500 });
    }

    if (!keywords.length) return Response.json({ topics: [] });

    // 2. Obține volume din DataForSEO
    const credentials = Buffer.from(
      `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
    ).toString('base64');

    const dfsRes = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keywords,
          location_code: 2642,
          language_code: 'ro',
        }]),
      }
    );

    const dfsData = await dfsRes.json();
    const items = dfsData?.tasks?.[0]?.result || [];

    console.log('[blogtopics] Claude keywords:', keywords.length, '| DFS results:', items.length);

    const topics = items
      .map(item => ({
        topic: item.keyword,
        volume: item.search_volume ?? 0,
        type: 'related',
      }))
      .filter(t => t.volume > 0)
      .sort((a, b) => b.volume - a.volume);

    return Response.json({ topics });
  } catch (e) {
    console.error('[blogtopics] error:', e.message);
    return Response.json({ topics: [], error: e.message }, { status: 500 });
  }
}
