const KEYWORDS = [
  'google', 'search', 'seo', 'algorithm', 'ranking', 'serp',
  'core update', 'spam update', 'helpful content', 'search update',
  'penalty', 'crawl', 'index', 'schema', 'ai overview',
  'search console', 'analytics', 'backlink', 'content',
];

const FEEDS = [
  'https://searchengineland.com/feed',
  'https://www.seroundtable.com/feed',
];

function decodeHtml(str) {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([^<]*)<\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = decodeHtml(get('title'));
    const link = get('link') || block.match(/<link>([^<]+)<\/link>/)?.[1]?.trim() || '';
    const pubDate = get('pubDate');
    const description = decodeHtml(get('description').replace(/<[^>]+>/g, '')).slice(0, 300);
    items.push({ title, link, pubDate, description });
  }
  return items;
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      FEEDS.map(url => fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 0 } }).then(r => r.text()))
    );

    const allItems = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...parseItems(result.value));
      }
    }

    // Filtrează: cel puțin un keyword relevant în titlu sau descriere
    const filtered = allItems.filter(item => {
      const text = (item.title + ' ' + item.description).toLowerCase();
      return KEYWORDS.some(kw => text.includes(kw));
    });

    // Sortează după dată descrescător
    filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Elimină duplicate după titlu
    const seen = new Set();
    const unique = filtered.filter(item => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    });

    return Response.json({ items: unique.slice(0, 50) });
  } catch (e) {
    console.error('[google-updates] error:', e.message);
    return Response.json({ items: [] });
  }
}
