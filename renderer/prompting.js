/*
 * Prompting — assemble le message envoyé au LLM local (v1.2).
 *
 * C'est ici que les deux cerveaux se rejoignent : les faits retrouvés dans
 * la mémoire auto-apprise (brain.recallTop) sont injectés dans le prompt du
 * LLM, qui s'appuie dessus et cite ses sources — le principe du RAG
 * (retrieval-augmented generation), la méthode de référence pour donner des
 * connaissances à jour et locales à un modèle de langage.
 */

const Prompting = {
  /** Tronque proprement un fait trop long (limite le budget de contexte). */
  clip(text, max = 300) {
    const t = String(text || '').trim();
    return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
  },

  /**
   * Message utilisateur complet : les faits appris pertinents (s'il y en a),
   * puis la question. Sans fait, la question passe telle quelle — le LLM
   * répond avec ses propres connaissances et la consigne d'honnêteté du
   * système fait le reste.
   */
  userPrompt(question, facts = []) {
    const q = String(question || '').trim();
    if (!facts.length) return q;
    const lines = facts.slice(0, 5).map((f, i) =>
      `${i + 1}. (source : ${f.source || 'inconnue'}) ${Prompting.clip(f.text)}`);
    return [
      'Faits appris par ta mémoire locale (à utiliser en priorité, cite la source) :',
      ...lines,
      '',
      'Question : ' + q
    ].join('\n');
  }
};

window.Prompting = Prompting;
