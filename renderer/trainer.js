/*
 * Trainer — accès internet du modèle, multi-sources.
 *
 * Sources fiables interrogées EN PARALLÈLE pour accélérer l'apprentissage :
 *  - encyclopédies MediaWiki : Wikipédia, Vikidia, Wikinews, Wiktionnaire, Wikisource ;
 *  - actualités : flux RSS de grands médias français ;
 *  - YouTube : sous-titres d'une vidéo dont on colle le lien en sujet.
 *
 * Les requêtes qui exigent de contourner CORS (RSS, YouTube) passent par le
 * processus principal Electron (window.native.fetchText) ; en son absence
 * (tests navigateur), on retombe sur fetch directement.
 */

const MEDIAWIKI_SOURCES = {
  wikipedia:  { label: 'Wikipédia',   api: 'https://fr.wikipedia.org/w/api.php' },
  vikidia:    { label: 'Vikidia',     api: 'https://fr.vikidia.org/w/api.php' },
  wikinews:   { label: 'Wikinews',    api: 'https://fr.wikinews.org/w/api.php' },
  wiktionary: { label: 'Wiktionnaire', api: 'https://fr.wiktionary.org/w/api.php' },
  wikisource: { label: 'Wikisource',  api: 'https://fr.wikisource.org/w/api.php' },
  wikibooks:  { label: 'Wikibooks',   api: 'https://fr.wikibooks.org/w/api.php' },
  wikiversity: { label: 'Wikiversité', api: 'https://fr.wikiversity.org/w/api.php' }
};

const RSS_FEEDS = [
  { name: 'France Info', url: 'https://www.francetvinfo.fr/titres.rss' },
  { name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' }
];

// Ensemble utilisé par le mode « toutes les sources » (le Wiktionnaire et
// Wikisource sont surtout utiles avec un sujet précis).
const ALL_SOURCES_RANDOM = ['wikipedia', 'vikidia', 'wikinews', 'wikibooks', 'rss'];
const ALL_SOURCES_TOPIC = ['wikipedia', 'vikidia', 'wikinews', 'wiktionary', 'wikisource', 'wikibooks', 'wikiversity', 'rss'];

async function nativeFetchText(url) {
  if (window.native && window.native.fetchText) {
    const res = await window.native.fetchText(url);
    if (!res.ok) throw new Error(res.error || ('HTTP ' + res.status));
    return res.text;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

/* ---------- Encyclopédies MediaWiki ---------- */

async function wikiQuery(api, params) {
  const url = api + '?' + new URLSearchParams({
    format: 'json',
    origin: '*',
    action: 'query',
    ...params
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function firstPage(data) {
  const pages = data && data.query && data.query.pages;
  if (!pages) return null;
  for (const id in pages) {
    const p = pages[id];
    if (p.extract && p.extract.trim().length > 80) {
      return { title: p.title, extract: p.extract.trim() };
    }
  }
  return null;
}

async function fetchFromMediaWiki(sourceKey, topic) {
  const src = MEDIAWIKI_SOURCES[sourceKey];
  const params = topic
    ? { generator: 'search', gsrsearch: topic, gsrlimit: '3', gsrnamespace: '0',
        prop: 'extracts', explaintext: '1', exintro: '1', exlimit: 'max' }
    : { generator: 'random', grnnamespace: '0', grnlimit: '3',
        prop: 'extracts', explaintext: '1', exintro: '1', exlimit: 'max' };
  const page = firstPage(await wikiQuery(src.api, params));
  if (!page) return null;
  return { sourceLabel: src.label, title: page.title, extract: page.extract };
}

/* ---------- Actualités (RSS) ---------- */

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

async function fetchFromRSS(topic) {
  const feed = RSS_FEEDS[Math.floor(Math.random() * RSS_FEEDS.length)];
  const xml = await nativeFetchText(feed.url);
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  let items = [...doc.querySelectorAll('item')].map(item => ({
    title: (item.querySelector('title')?.textContent || '').trim(),
    desc: stripHtml(item.querySelector('description')?.textContent || '').trim()
  })).filter(i => i.title);

  if (topic) {
    const t = topic.toLowerCase();
    const filtered = items.filter(i => (i.title + ' ' + i.desc).toLowerCase().includes(t));
    if (filtered.length) items = filtered;
  }
  if (!items.length) return null;

  const picked = items.slice(0, 6);
  const extract = picked.map(i => {
    let s = i.title;
    if (!/[.!?]$/.test(s)) s += '.';
    return s + (i.desc ? ' ' + i.desc : '');
  }).join(' ');
  return { sourceLabel: feed.name, title: `Actualités ${feed.name}`, extract };
}

/* ---------- YouTube (sous-titres) ---------- */

function youtubeVideoId(text) {
  const m = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function fetchFromYouTube(videoUrl) {
  const id = youtubeVideoId(videoUrl);
  if (!id) throw new Error('Lien YouTube non reconnu');

  let title = 'Vidéo YouTube';
  try {
    const oembed = await nativeFetchText(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    title = JSON.parse(oembed).title || title;
  } catch (e) { /* titre facultatif */ }

  for (const lang of ['fr', 'en']) {
    try {
      const xml = await nativeFetchText(`https://video.google.com/timedtext?lang=${lang}&v=${id}`);
      if (!xml || !xml.includes('<text')) continue;
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const lines = [...doc.querySelectorAll('text')].map(n => n.textContent.trim()).filter(Boolean);
      if (!lines.length) continue;
      return { sourceLabel: 'YouTube', title, extract: lines.join(' ').slice(0, 4000) };
    } catch (e) { /* essaie la langue suivante */ }
  }
  throw new Error('Cette vidéo n\'a pas de sous-titres accessibles');
}

/* ---------- Images réelles (Wikimedia Commons) ---------- */

/** URLs de vignettes d'images libres sur un sujet, pour apprendre leurs palettes. */
async function fetchCommonsImages(topic, limit = 4) {
  const data = await wikiQuery('https://commons.wikimedia.org/w/api.php', {
    generator: 'search',
    gsrsearch: topic,
    gsrnamespace: '6',
    gsrlimit: String(limit + 2),
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '160'
  });
  const pages = (data && data.query && data.query.pages) || {};
  return Object.values(pages)
    .map(p => p.imageinfo && p.imageinfo[0] && p.imageinfo[0].thumburl)
    .filter(u => u && /\.(jpe?g|png)$/i.test(u))
    .slice(0, limit);
}

/* ---------- PDF du web ---------- */

function isPdfUrl(text) {
  return /^https?:\/\/\S+\.pdf(\?\S*)?$/i.test((text || '').trim());
}

async function fetchFromPDF(url) {
  if (!window.native || !window.native.fetchPdfText) {
    throw new Error('La lecture de PDF nécessite l\'application de bureau');
  }
  const res = await window.native.fetchPdfText(url.trim());
  if (!res.ok) throw new Error(res.error || 'PDF illisible');
  const name = decodeURIComponent(url.split('/').pop().replace(/\.pdf.*/i, '').replace(/[-_]/g, ' '));
  return { sourceLabel: 'PDF', title: name || 'Document PDF', extract: res.text };
}

/* ---------- Récupération en parallèle ---------- */

/**
 * Interroge plusieurs sources en même temps.
 * @returns {Promise<{results: Array, errors: Array}>}
 */
async function fetchBatch(sourceKeys, topic) {
  const jobs = sourceKeys.map(key => {
    if (key === 'rss') return fetchFromRSS(topic);
    if (key === 'youtube') return fetchFromYouTube(topic);
    if (key === 'pdf') return fetchFromPDF(topic);
    return fetchFromMediaWiki(key, topic);
  });
  const settled = await Promise.allSettled(jobs);
  const results = [];
  const errors = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled' && s.value) results.push(s.value);
    else if (s.status === 'rejected') errors.push({ source: sourceKeys[i], error: String((s.reason && s.reason.message) || s.reason) });
  });
  return { results, errors };
}

/** Détermine les sources d'un cycle selon le choix de l'utilisateur et le sujet. */
function resolveSources(choice, topic) {
  if (isPdfUrl(topic)) return ['pdf'];
  if (youtubeVideoId(topic || '')) return ['youtube'];
  if (choice === 'all') return topic ? ALL_SOURCES_TOPIC : ALL_SOURCES_RANDOM;
  return [choice];
}

window.Trainer = { MEDIAWIKI_SOURCES, fetchBatch, resolveSources, youtubeVideoId, isPdfUrl, fetchCommonsImages };
