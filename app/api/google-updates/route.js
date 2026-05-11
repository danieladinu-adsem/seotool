const KEYWORDS = [
  'google', 'search', 'seo', 'algorithm', 'ranking', 'serp',
  'core update', 'spam update', 'helpful content', 'search update',
  'penalty', 'crawl', 'index', 'schema', 'ai overview',
  'search console', 'analytics', 'backlink', 'content',
];

const EXCLUDE_KEYWORDS = [
  'google ads', 'paid search', 'paid media', 'ppc', 'adwords',
  'advertising', 'paid campaign', 'display ads', 'shopping ads',
  'performance max', 'smart bidding', 'ad spend', 'cpc', 'cpm',
];

const FEEDS = [
  'https://searchengineland.com/feed',
  'https://searchengineland.com/feed/?paged=2',
  'https://www.seroundtable.com/feed',
  'https://www.seroundtable.com/feed/?paged=2',
  'https://feeds.feedburner.com/SearchEngineLand',
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
    if (title && link) items.push({ title, link, pubDate, description });
  }
  return items;
}

async function fetchFeed(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[google-updates] ${url} returned ${res.status}`);
      return [];
    }
    const text = await res.text();
    const items = parseItems(text);
    console.log(`[google-updates] ${url}: ${items.length} items`);
    return items;
  } catch (e) {
    clearTimeout(timeout);
    console.error(`[google-updates] fetch failed for ${url}:`, e.message);
    return [];
  }
}

export async function GET() {
  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));

    const allItems = [];
    for (const result of results) {
      if (result.status === 'fulfilled') allItems.push(...result.value);
    }

    console.log(`[google-updates] total raw items: ${allItems.length}`);

    const filtered = allItems.filter(item => {
      const text = (item.title + ' ' + item.description).toLowerCase();
      const hasRelevant = KEYWORDS.some(kw => text.includes(kw));
      const hasExcluded = EXCLUDE_KEYWORDS.some(kw => text.includes(kw));
      return hasRelevant && !hasExcluded;
    });

    filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    const seen = new Set();
    const unique = filtered.filter(item => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    });

    console.log(`[google-updates] filtered unique: ${unique.length}`);
    return Response.json({ items: unique.slice(0, 100) });
  } catch (e) {
    console.error('[google-updates] error:', e.message);
    return Response.json({ items: [], error: e.message });
  }
}
