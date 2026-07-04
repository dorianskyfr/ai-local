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
// « web » = recherche libre sur tout le web (DuckDuckGo), pas limitée aux
// sources prédéfinies ci-dessus — seulement utile avec un sujet donné.
const ALL_SOURCES_TOPIC = ['wikipedia', 'vikidia', 'wikinews', 'wiktionary', 'wikisource', 'wikibooks', 'wikiversity', 'rss', 'web'];

const SOURCE_LABELS = {
  rss: 'Actualités',
  youtube: 'YouTube',
  pdf: 'PDF',
  web: 'Recherche web',
  webpage: 'Page web',
  'video-oembed': 'Vidéo (web)'
};

function sourceLabel(key) {
  return (MEDIAWIKI_SOURCES[key] && MEDIAWIKI_SOURCES[key].label) || SOURCE_LABELS[key] || key;
}

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

async function fetchFromMediaWiki(sourceKey, topic, opts = {}) {
  const src = MEDIAWIKI_SOURCES[sourceKey];
  // Par défaut on ne lit que l'intro (rapide, suffisant pour l'entraînement
  // en volume). En mode fullText — utilisé quand le chat cherche la réponse
  // à une question précise — on lit l'article en entier : les données
  // factuelles (population d'un village, dates…) ne sont presque jamais
  // dans l'intro mais dans le corps de l'article.
  const extractParams = opts.fullText
    ? { prop: 'extracts', explaintext: '1', exlimit: 'max', exchars: '6000' }
    : { prop: 'extracts', explaintext: '1', exintro: '1', exlimit: 'max' };
  const params = topic
    ? { generator: 'search', gsrsearch: topic, gsrlimit: '3', gsrnamespace: '0', ...extractParams }
    : { generator: 'random', grnnamespace: '0', grnlimit: '3', ...extractParams };
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

/* ---------- N'importe quelle page web ---------- */

function isWebUrl(text) {
  return /^https?:\/\/\S+$/i.test((text || '').trim());
}

/** Extrait le texte lisible et les images d'une page HTML quelconque. */
async function fetchFromURL(url) {
  const clean = url.trim();
  const html = await nativeFetchText(clean);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, nav, header, footer').forEach(el => el.remove());

  const text = (doc.body ? doc.body.textContent : doc.documentElement.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 150) {
    throw new Error('Page trop courte ou illisible (contenu probablement généré par script)');
  }

  const title = (doc.querySelector('title')?.textContent || '').trim();
  let domain = clean;
  try { domain = new URL(clean).hostname.replace(/^www\./, ''); } catch (e) { /* garde l'URL brute */ }

  const images = [...doc.querySelectorAll('img[src]')]
    .map(img => { try { return new URL(img.getAttribute('src'), clean).href; } catch (e) { return null; } })
    .filter(u => u && /\.(jpe?g|png|webp)(\?|$)/i.test(u))
    .slice(0, 4);

  return { sourceLabel: domain, title: title || domain, extract: text.slice(0, 6000), images };
}

function decodeDuckDuckGoLink(href) {
  const m = href.match(/[?&]uddg=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : href;
}

function extractResultLinks(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let links = [...doc.querySelectorAll('a.result__a, a.result-link')];
  if (!links.length) {
    // Repli : n'importe quel lien externe qui n'appartient pas à DuckDuckGo lui-même.
    links = [...doc.querySelectorAll('a[href]')].filter(a => {
      const href = a.getAttribute('href') || '';
      return (isWebUrl(href) || href.includes('uddg=')) && !/(^|\/\/)([\w-]+\.)?duckduckgo\.com/i.test(decodeDuckDuckGoLink(href));
    });
  }
  return links;
}

/**
 * Recherche libre sur tout le web (DuckDuckGo, sans clé) puis lit le meilleur
 * résultat. Deux points d'entrée sont essayés (page « html » complète, puis
 * la version « lite » plus simple) : si l'un change de structure ou bloque
 * la requête, l'autre prend le relais plutôt que d'échouer silencieusement.
 */
async function fetchFromWebSearch(query) {
  const endpoints = [
    'https://html.duckduckgo.com/html/?q=',
    'https://lite.duckduckgo.com/lite/?q='
  ];
  let lastError = null;

  for (const endpoint of endpoints) {
    let html;
    try {
      html = await nativeFetchText(endpoint + encodeURIComponent(query));
    } catch (e) {
      lastError = e;
      continue;
    }
    const links = extractResultLinks(html);
    if (!links.length) {
      lastError = new Error(html.length < 500 ? 'Réponse de recherche trop courte (possible blocage)' : 'Aucun lien de résultat trouvé sur la page');
      continue;
    }
    for (const link of links.slice(0, 6)) {
      const href = decodeDuckDuckGoLink(link.getAttribute('href') || '');
      if (!isWebUrl(href) || isPdfUrl(href)) continue;
      try {
        const page = await fetchFromURL(href);
        return { sourceLabel: page.sourceLabel, title: link.textContent.trim() || page.title, extract: page.extract, images: page.images };
      } catch (e) { /* résultat illisible : on essaie le suivant */ }
    }
  }
  throw new Error(`Aucun résultat web exploitable pour « ${query} »${lastError ? ' (' + lastError.message + ')' : ''}`);
}

/* ---------- Autres plateformes vidéo (métadonnées uniquement) ---------- */

function detectOEmbedPlatform(text) {
  const t = (text || '').trim();
  if (/vimeo\.com\/\d+/i.test(t)) return { name: 'Vimeo', endpoint: 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(t) };
  if (/dailymotion\.com\/video\/|dai\.ly\//i.test(t)) return { name: 'Dailymotion', endpoint: 'https://www.dailymotion.com/services/oembed?url=' + encodeURIComponent(t) };
  return null;
}

/**
 * Un modèle de texte local ne peut pas « regarder » une vidéo : on ne
 * récupère que son titre et sa description publique (métadonnées), pas son
 * contenu réel. Honnête et limité, mais mieux que rien pour ces plateformes.
 */
async function fetchFromVideoOEmbed(url) {
  const platform = detectOEmbedPlatform(url);
  if (!platform) throw new Error('Plateforme vidéo non reconnue');
  const json = await nativeFetchText(platform.endpoint);
  const data = JSON.parse(json);
  const extract = `${data.title || 'Vidéo'}. ${data.author_name ? 'Par ' + data.author_name + '.' : ''} ${data.description || ''}`.trim();
  if (extract.length < 20) throw new Error('Pas assez de métadonnées publiques pour cette vidéo');
  return { sourceLabel: platform.name, title: data.title || platform.name, extract };
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
async function fetchBatch(sourceKeys, topic, opts = {}) {
  const jobs = sourceKeys.map(key => {
    if (key === 'rss') return fetchFromRSS(topic);
    if (key === 'youtube') return fetchFromYouTube(topic);
    if (key === 'pdf') return fetchFromPDF(topic);
    if (key === 'web') return fetchFromWebSearch(topic);
    if (key === 'webpage') return fetchFromURL(topic);
    if (key === 'video-oembed') return fetchFromVideoOEmbed(topic);
    return fetchFromMediaWiki(key, topic, opts);
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
  // Un lien collé dans le sujet prime toujours sur le menu déroulant.
  if (isPdfUrl(topic)) return ['pdf'];
  if (youtubeVideoId(topic || '')) return ['youtube'];
  if (detectOEmbedPlatform(topic)) return ['video-oembed'];
  if (isWebUrl(topic)) return ['webpage'];
  if (choice === 'all') return topic ? ALL_SOURCES_TOPIC : ALL_SOURCES_RANDOM;
  return [choice];
}

window.Trainer = {
  MEDIAWIKI_SOURCES, fetchBatch, resolveSources, youtubeVideoId, isPdfUrl,
  isWebUrl, fetchCommonsImages, sourceLabel
};
