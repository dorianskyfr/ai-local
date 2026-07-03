/*
 * Trainer — accès internet du modèle : récupération de textes sur Wikipédia
 * (français) pour l'entraînement, sur un sujet précis ou au hasard.
 * En cas d'absence de connexion, l'appelant se replie sur
 * l'auto-entraînement local.
 */

const WIKI_API = 'https://fr.wikipedia.org/w/api.php';

async function wikiQuery(params) {
  const url = WIKI_API + '?' + new URLSearchParams({
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

/** Article aléatoire avec son texte (sujet libre). */
async function fetchRandomArticle() {
  const data = await wikiQuery({
    generator: 'random',
    grnnamespace: '0',
    grnlimit: '3',
    prop: 'extracts',
    explaintext: '1',
    exintro: '1',
    exlimit: 'max'
  });
  return firstPage(data);
}

/** Meilleur article sur un sujet donné, avec son texte. */
async function fetchArticleOnTopic(topic) {
  const data = await wikiQuery({
    generator: 'search',
    gsrsearch: topic,
    gsrlimit: '3',
    gsrnamespace: '0',
    prop: 'extracts',
    explaintext: '1',
    exintro: '1',
    exlimit: 'max'
  });
  return firstPage(data);
}

window.Trainer = { fetchRandomArticle, fetchArticleOnTopic };
