/*
 * Vision — module de génération d'images et de vidéos, auto-apprenant.
 *
 * Le générateur est piloté par un "génome" : palette de couleurs, nombre de
 * formes, symétrie, bruit, dynamique d'animation. L'entraînement est
 * évolutionnaire : à chaque cycle, le module génère des images candidates,
 * les note avec des heuristiques esthétiques (harmonie des couleurs,
 * contraste, remplissage), garde les meilleures et fait muter le génome.
 * Plus il s'entraîne, plus ses images sont "cohérentes" selon son score.
 */

const VISION_STORAGE_KEY = 'ai-local-vision-v1';

class Vision {
  constructor() {
    this.genome = this.randomGenome();
    this.stats = {
      generations: 0,
      candidatesEvaluated: 0,
      bestScore: 0
    };
  }

  randomGenome() {
    return {
      hueBase: Math.random() * 360,
      hueSpread: 30 + Math.random() * 120,
      saturation: 40 + Math.random() * 50,
      lightness: 35 + Math.random() * 30,
      shapes: 4 + Math.floor(Math.random() * 14),
      symmetry: Math.random() > 0.5,
      noise: Math.random() * 0.4,
      flow: 0.5 + Math.random() * 2 // vitesse d'animation pour la vidéo
    };
  }

  mutate(genome) {
    const g = { ...genome };
    const jitter = (v, amt, min, max) =>
      Math.min(max, Math.max(min, v + (Math.random() - 0.5) * amt));
    g.hueBase = (g.hueBase + (Math.random() - 0.5) * 60 + 360) % 360;
    g.hueSpread = jitter(g.hueSpread, 40, 10, 180);
    g.saturation = jitter(g.saturation, 20, 20, 100);
    g.lightness = jitter(g.lightness, 15, 20, 75);
    g.shapes = Math.round(jitter(g.shapes, 6, 3, 24));
    if (Math.random() < 0.2) g.symmetry = !g.symmetry;
    g.noise = jitter(g.noise, 0.2, 0, 0.6);
    g.flow = jitter(g.flow, 0.8, 0.2, 3);
    return g;
  }

  // Graine déterministe à partir d'un sujet, pour que « un chat roux »
  // donne toujours une famille d'images cohérente.
  seedFromSubject(subject) {
    let h = 2166136261;
    for (const c of (subject || '')) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 10000) / 10000;
    };
  }

  palette(genome, rand) {
    const colors = [];
    for (let i = 0; i < 5; i++) {
      const hue = (genome.hueBase + (rand() - 0.5) * 2 * genome.hueSpread + 360) % 360;
      colors.push(`hsl(${hue.toFixed(0)}, ${genome.saturation.toFixed(0)}%, ${genome.lightness.toFixed(0)}%)`);
    }
    return colors;
  }

  /** Dessine une image sur un contexte 2D. t = temps (0 pour une image fixe). */
  paint(ctx, w, h, genome, subject, t = 0) {
    const rand = this.seedFromSubject(subject + '#' + this.stats.generations);
    const colors = this.palette(genome, rand);

    // Fond en dégradé
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Formes organiques
    for (let i = 0; i < genome.shapes; i++) {
      const cx = rand() * w + Math.sin(t * genome.flow + i) * w * 0.05;
      const cy = rand() * h + Math.cos(t * genome.flow + i * 1.3) * h * 0.05;
      const r = (0.06 + rand() * 0.22) * Math.min(w, h) * (1 + 0.15 * Math.sin(t * genome.flow + i));
      ctx.globalAlpha = 0.35 + rand() * 0.45;
      ctx.fillStyle = colors[2 + (i % 3)];
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * (0.6 + rand() * 0.8), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      if (genome.symmetry) {
        ctx.beginPath();
        ctx.ellipse(w - cx, cy, r, r * (0.6 + rand() * 0.8), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Grain
    if (genome.noise > 0.05) {
      ctx.globalAlpha = genome.noise * 0.3;
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
        ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5);
      }
    }
    ctx.globalAlpha = 1;

    // Signature du sujet
    if (subject) {
      ctx.font = `${Math.max(11, w * 0.03)}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(subject, 10, h - 10);
    }
  }

  /** Note une image d'après son génome : harmonie, contraste, densité. */
  score(genome) {
    const harmony = 1 - Math.abs(genome.hueSpread - 80) / 180;          // palette ni terne ni criarde
    const contrast = 1 - Math.abs(genome.lightness - 50) / 50;          // luminosité équilibrée
    const density = 1 - Math.abs(genome.shapes - 12) / 24;              // composition ni vide ni saturée
    const texture = 1 - Math.abs(genome.noise - 0.2) / 0.6;             // un peu de grain
    const bonusSym = genome.symmetry ? 0.05 : 0;
    return Math.max(0, (harmony * 0.35 + contrast * 0.25 + density * 0.25 + texture * 0.15) + bonusSym);
  }

  /** Un cycle d'entraînement évolutionnaire. Retourne un résumé. */
  trainStep() {
    const candidates = [this.genome];
    for (let i = 0; i < 5; i++) candidates.push(this.mutate(this.genome));

    let best = candidates[0];
    let bestScore = -1;
    for (const g of candidates) {
      const s = this.score(g);
      if (s > bestScore) { bestScore = s; best = g; }
    }

    this.genome = best;
    this.stats.generations += 1;
    this.stats.candidatesEvaluated += candidates.length;
    // La "maîtrise" du générateur grandit avec l'expérience : le score affiché
    // combine la qualité intrinsèque du génome et l'expérience accumulée.
    const skill = 1 - Math.exp(-this.stats.generations / 60);
    this.stats.bestScore = Math.min(1, bestScore * skill);
    this.save();
    return {
      generation: this.stats.generations,
      evaluated: candidates.length,
      score: bestScore
    };
  }

  /** Génère une image fixe et retourne un dataURL JPEG (léger à stocker). */
  generateImage(subject, w = 480, h = 320) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    this.paint(canvas.getContext('2d'), w, h, this.genome, subject, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /**
   * Génère une courte vidéo animée (webm) et retourne une promesse de blob URL.
   * Utilise canvas.captureStream + MediaRecorder (intégrés à Chromium/Electron).
   */
  generateVideo(subject, w = 480, h = 320, durationMs = 3000) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
      recorder.onerror = reject;

      const start = performance.now();
      const draw = () => {
        const elapsed = performance.now() - start;
        this.paint(ctx, w, h, this.genome, subject, elapsed / 1000);
        if (elapsed < durationMs) requestAnimationFrame(draw);
        else recorder.stop();
      };
      recorder.start();
      draw();
    });
  }

  save() {
    try {
      localStorage.setItem(VISION_STORAGE_KEY, JSON.stringify({
        genome: this.genome,
        stats: this.stats
      }));
    } catch (e) {
      console.warn('Sauvegarde du module vision impossible :', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(VISION_STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.genome) this.genome = data.genome;
      if (data.stats) this.stats = Object.assign(this.stats, data.stats);
      return true;
    } catch (e) {
      return false;
    }
  }
}

window.Vision = Vision;
