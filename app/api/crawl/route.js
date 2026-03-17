function cleanText(raw) {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return [...html.matchAll(re)].map(m => cleanText(m[1])).filter(Boolean);
}

function extractNavLinks(html) {
  const blocks = [...html.matchAll(/<(?:nav|header)[^>]*>([\s\S]*?)<\/(?:nav|header)>/gi)];
  return blocks.flatMap(b =>
    [...b[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map(m => cleanText(m[1]))
  );
}

export async function POST(request) {
  let { url } = await request.json();
  if (!url) return Response.json({ error: 'URL lipsă' }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let html;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOTool/1.0; +https://seotool.ro)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return Response.json({ error: `Site-ul a returnat ${res.status}` }, { status: 400 });
    html = await res.text();
  } catch (e) {
    return Response.json({ error: 'Nu s-a putut accesa URL-ul. Verifică adresa sau încearcă mai târziu.' }, { status: 400 });
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : '';

  const h1s = extractTag(html, 'h1');
  const h2s = extractTag(html, 'h2');
  const navLinks = extractNavLinks(html);

  // Detectare tip site
  const lower = html.toLowerCase();
  const ecomWords = ['categorie', 'categorii', 'produs', 'produse', 'shop', 'cart', 'cos', 'adauga in cos', 'cumpara acum', 'pret', 'stoc', 'livrare'];
  const isEcommerce = ecomWords.filter(w => lower.includes(w)).length >= 2;

  // Construieste lista de keywords candidati
  const candidates = [title, ...h1s, ...h2s, ...navLinks]
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length >= 3 && k.length <= 80)
    .filter(k => !/^(home|acasa|menu|meniu|\d+)$/i.test(k))
    .filter(k => k.split(/\s+/).length <= 5);

  const keywords = [...new Set(candidates)];

  return Response.json({
    keywords,
    siteType: isEcommerce ? 'ecommerce' : 'services',
  });
}
