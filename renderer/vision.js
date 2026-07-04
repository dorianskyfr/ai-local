/*
 * Vision — module de génération d'images et de vidéos, auto-apprenant.
 *
 * v2 : le générateur compose de vraies scènes (ciel en dégradé, soleil,
 * montagnes, vagues, nuages, étoiles) au lieu de simples taches. Les couleurs
 * viennent du sujet demandé et des PALETTES APPRISES sur de vraies images du
 * web (Wikimedia Commons) pendant l'entraînement.
 *
 * L'entraînement reste évolutionnaire : un « génome » (palette, densité,
 * symétrie, grain, dynamique) mute, les candidats sont notés et le meilleur
 * survit.
 */

const VISION_STORAGE_KEY = 'ai-local-vision-v1';

// Paliers de progression internes et ludiques (voir la même remarque dans
// brain.js) : pas une comparaison avec de vrais générateurs d'images.
const IMAGE_TIERS = [
  { min: 0,   name: 'Gribouillage',            icon: '🖍️' },
  { min: 20,  name: 'Apprenti peintre',         icon: '🎨' },
  { min: 60,  name: 'Coloriste',                icon: '🌈' },
  { min: 150, name: 'Compositeur de scènes',    icon: '🖼️' },
  { min: 350, name: 'Artiste confirmé',         icon: '🏆' },
  { min: 700, name: 'Maître générateur',        icon: '✨' },
  { min: 1500, name: 'Virtuose du pixel',       icon: '🎇' },
  { min: 3500, name: 'Légende du pinceau',      icon: '👑' }
];

class Vision {
  constructor() {
    this.genome = this.randomGenome();
    // Palettes apprises sur de vraies images : { motclé: [{h,s,l}, ...] }
    this.learnedPalettes = {};
    this.stats = {
      generations: 0,
      candidatesEvaluated: 0,
      bestScore: 0,
      palettesLearned: 0
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
      flow: 0.5 + Math.random() * 2
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

  subjectKeywords(subject) {
    return (subject || '')
      .toLowerCase()
      .split(/[^a-zà-ÿ0-9]+/i)
      .filter(w => w.length >= 4);
  }

  /** Choisit un archétype de scène selon des mots-clés du sujet. */
  sceneType(subject) {
    const s = (subject || '').toLowerCase();
    if (/volcan|lave|lava|[ée]ruption|magma/.test(s)) return 'volcano';
    if (/oc[ée]an|\bmer\b|vague|plage|surf|\b[îi]le\b/.test(s)) return 'ocean';
    if (/for[êe]t|arbre|jungle|\bbois\b/.test(s)) return 'forest';
    if (/espace|galaxie|[ée]toile|n[ée]buleuse|plan[èe]te|cosmos|univers/.test(s)) return 'space';
    return 'default';
  }

  /* ---------- Palettes apprises sur de vraies images ---------- */

  /** Extrait les couleurs dominantes d'une image déjà dessinée sur un canvas. */
  extractPalette(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    const buckets = {};
    for (let i = 0; i < data.length; i += 16) {
      const [r, g, b] = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      let hDeg = 0;
      if (d > 0) {
        if (max === r) hDeg = 60 * (((g - b) / d) % 6);
        else if (max === g) hDeg = 60 * ((b - r) / d + 2);
        else hDeg = 60 * ((r - g) / d + 4);
      }
      hDeg = (hDeg + 360) % 360;
      const key = Math.round(hDeg / 24) + ':' + Math.round(l * 4);
      if (!buckets[key]) buckets[key] = { h: 0, s: 0, l: 0, n: 0 };
      const bk = buckets[key];
      bk.h += hDeg; bk.s += s * 100; bk.l += l * 100; bk.n += 1;
    }
    return Object.values(buckets)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
      .map(bk => ({
        h: Math.round(bk.h / bk.n),
        s: Math.min(90, Math.round(bk.s / bk.n) + 12), // ravive un peu
        l: Math.max(25, Math.min(72, Math.round(bk.l / bk.n)))
      }));
  }

  /** Apprend la palette d'une vraie image (élément <img> chargé) pour un sujet. */
  learnPaletteFromImage(subject, img) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 48;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 48, 48);
      const palette = this.extractPalette(ctx, 48, 48);
      if (palette.length < 3) return false;
      for (const kw of this.subjectKeywords(subject)) {
        this.learnedPalettes[kw] = palette;
      }
      const keys = Object.keys(this.learnedPalettes);
      while (keys.length > 80) delete this.learnedPalettes[keys.shift()];
      this.stats.palettesLearned += 1;
      this.save();
      return true;
    } catch (e) {
      return false; // image non accessible (CORS) : tant pis
    }
  }

  /** Palette pour un sujet : apprise si possible, sinon dérivée du sujet + génome. */
  paletteFor(subject, genome, rand) {
    for (const kw of this.subjectKeywords(subject)) {
      if (this.learnedPalettes[kw]) {
        return this.learnedPalettes[kw].map(c => ({
          h: (c.h + (rand() - 0.5) * 14 + 360) % 360,
          s: Math.min(95, c.s + (rand() - 0.5) * 8),
          l: Math.min(80, Math.max(18, c.l + (rand() - 0.5) * 8))
        }));
      }
    }
    const subjectHue = Math.floor(rand() * 360);
    const base = (subjectHue * 0.6 + genome.hueBase * 0.4) % 360;
    const cols = [];
    for (let i = 0; i < 5; i++) {
      cols.push({
        h: (base + (i - 2) * (genome.hueSpread / 3) + 360) % 360,
        s: Math.min(95, genome.saturation + (rand() - 0.5) * 16),
        l: Math.min(78, Math.max(20, genome.lightness + (i - 2) * 9))
      });
    }
    return cols;
  }

  /* ---------- Composition de scène ---------- */

  hsl(c, alpha = 1, dl = 0) {
    const l = Math.max(4, Math.min(96, c.l + dl));
    return alpha >= 1
      ? `hsl(${c.h.toFixed(0)}, ${c.s.toFixed(0)}%, ${l.toFixed(0)}%)`
      : `hsla(${c.h.toFixed(0)}, ${c.s.toFixed(0)}%, ${l.toFixed(0)}%, ${alpha})`;
  }

  paint(ctx, w, h, genome, subject, t = 0) {
    const rand = this.seedFromSubject(subject || 'création libre');
    const colors = this.paletteFor(subject, genome, rand);
    const scene = this.sceneType(subject);
    const sky = colors[0];
    const horizon = colors[1];
    const darkSky = sky.l < 38 || scene === 'space';

    // Léger travelling caméra (zoom + dérive horizontale) pour que les
    // vidéos donnent une vraie impression de mouvement plutôt qu'un décor
    // fixe où seuls les éléments bougent. Toujours zoomé ≥ 1 pour ne jamais
    // révéler de bord vide. Le texte du sujet est dessiné après restore(),
    // donc reste net et fixe.
    ctx.save();
    const zoom = 1 + 0.045 * (0.5 + 0.5 * Math.sin(t * genome.flow * 0.12));
    const panX = Math.sin(t * genome.flow * 0.07) * w * 0.018;
    const panY = Math.cos(t * genome.flow * 0.05) * h * 0.012;
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2 + panX, -h / 2 + panY);

    // Ciel en dégradé
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (scene === 'volcano') {
      grad.addColorStop(0, this.hsl(sky, 1, -6));
      grad.addColorStop(0.6, this.hsl({ h: 14, s: 55, l: 22 }));
      grad.addColorStop(1, this.hsl({ h: 8, s: 40, l: 10 }));
    } else {
      grad.addColorStop(0, this.hsl(sky));
      grad.addColorStop(0.72, this.hsl(horizon, 1, 6));
      grad.addColorStop(1, this.hsl(colors[2], 1, -6));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Étoiles / poussière cosmique qui scintillent
    if (darkSky) {
      const starCount = scene === 'space' ? 140 : 60;
      for (let i = 0; i < starCount; i++) {
        const sx = rand() * w, sy = rand() * h * (scene === 'space' ? 0.92 : 0.55);
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
        const size = scene === 'space' && rand() > 0.88 ? 2.4 : 1.5;
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.globalAlpha = 1;
    }

    if (scene === 'space') {
      this.paintSpaceSky(ctx, w, h, colors, rand, t);
    } else {
      // Soleil / lune avec halo, pulsation douce
      const sunX = scene === 'ocean' ? w * 0.5 : (0.2 + rand() * 0.6) * w;
      const sunY = scene === 'ocean' ? h * 0.4 : (0.16 + rand() * 0.26) * h;
      const sunR = (0.07 + rand() * 0.05) * Math.min(w, h) * (1 + 0.04 * Math.sin(t * genome.flow));
      const warm = darkSky
        ? { h: 48, s: 18, l: 88 }
        : { h: scene === 'volcano' ? 22 : 42, s: scene === 'volcano' ? 95 : 92, l: 66 };
      const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 3);
      halo.addColorStop(0, this.hsl(warm, 0.85));
      halo.addColorStop(1, this.hsl(warm, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
      ctx.fillStyle = this.hsl(warm);
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
      if (scene === 'ocean') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = this.hsl(warm);
        for (let i = 0; i < 6; i++) {
          const ry = h * 0.8 + i * 9;
          const rw = sunR * (1.4 - i * 0.16);
          ctx.fillRect(sunX - rw / 2, ry, rw, 4);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Nuages / fumée qui dérivent (pas dans l'espace)
    if (scene !== 'space') {
      const cloudCount = scene === 'volcano' ? 3 : 2 + Math.floor(rand() * 3);
      for (let i = 0; i < cloudCount; i++) {
        const drift = ((rand() * w) + t * 14 * genome.flow) % (w + 160) - 80;
        const cy = scene === 'volcano' ? h * (0.1 + rand() * 0.15) : (0.12 + rand() * 0.3) * h;
        const scale = 0.5 + rand() * 0.9;
        const cloudColor = scene === 'volcano'
          ? { h: 20, s: 15, l: 25 }
          : { h: sky.h, s: Math.min(40, sky.s), l: darkSky ? 30 : 88 };
        ctx.fillStyle = this.hsl(cloudColor, 0.5);
        for (let p = 0; p < 4; p++) {
          ctx.beginPath();
          ctx.ellipse(drift + p * 26 * scale, cy + (p % 2) * 8 * scale, 30 * scale, 15 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Élément principal, propre à chaque type de scène
    if (scene === 'volcano') this.paintVolcano(ctx, w, h, colors, genome, rand, t);
    else if (scene === 'ocean') this.paintOcean(ctx, w, h, colors, genome, rand, t);
    else if (scene === 'forest') this.paintForest(ctx, w, h, colors, genome, rand, t);
    else if (scene === 'default') this.paintHillsAndWaves(ctx, w, h, colors, genome, rand, t);

    // Touches organiques (oiseaux) — pas dans l'espace ni le volcan
    if (scene !== 'space' && scene !== 'volcano') {
      const accents = Math.min(8, Math.floor(genome.shapes / 3));
      ctx.strokeStyle = this.hsl({ h: sky.h, s: 30, l: darkSky ? 80 : 22 }, 0.7);
      ctx.lineWidth = 1.6;
      for (let i = 0; i < accents; i++) {
        const bx = rand() * w;
        const by = (0.18 + rand() * 0.3) * h + Math.sin(t * 2 + i) * 3;
        ctx.beginPath();
        ctx.arc(bx - 5, by, 5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.arc(bx + 5, by, 5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    }

    // Grain léger
    if (genome.noise > 0.05) {
      ctx.globalAlpha = genome.noise * 0.22;
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
        ctx.fillRect(rand() * w, rand() * h, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // fin du travelling caméra — le texte ci-dessous reste fixe

    // Signature du sujet
    if (subject) {
      ctx.font = `${Math.max(11, w * 0.03)}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeText(subject, 10, h - 10);
      ctx.fillText(subject, 10, h - 10);
    }
  }

  paintSpaceSky(ctx, w, h, colors, rand, t) {
    // Nébuleuses : grands halos colorés superposés
    for (let i = 0; i < 3; i++) {
      const nx = (0.2 + rand() * 0.6) * w, ny = (0.15 + rand() * 0.5) * h;
      const nr = (0.25 + rand() * 0.2) * Math.max(w, h);
      const neb = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      neb.addColorStop(0, this.hsl(colors[(i + 2) % 5], 0.26));
      neb.addColorStop(1, this.hsl(colors[(i + 2) % 5], 0));
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);
    }
    // Planète avec anneau
    const px = (0.6 + rand() * 0.22) * w, py = (0.3 + rand() * 0.22) * h;
    const pr = (0.09 + rand() * 0.05) * Math.min(w, h);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.strokeStyle = this.hsl(colors[3], 0.7);
    ctx.lineWidth = pr * 0.16;
    ctx.beginPath();
    ctx.ellipse(0, 0, pr * 1.8, pr * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const pGrad = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
    pGrad.addColorStop(0, this.hsl(colors[4], 1, 14));
    pGrad.addColorStop(1, this.hsl(colors[4], 1, -14));
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    // Comète filante
    const cx = ((t * 60) % (w + 200)) - 100;
    const cy = h * 0.2 + Math.sin(t) * 10;
    const tail = ctx.createLinearGradient(cx, cy, cx - 70, cy + 30);
    tail.addColorStop(0, 'rgba(255,255,255,0.85)');
    tail.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = tail;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 70, cy + 30);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  paintVolcano(ctx, w, h, colors, genome, rand, t) {
    const baseY = h * 0.62;
    const peakX = w * 0.5 + (rand() - 0.5) * w * 0.1;
    const peakY = h * (0.22 + rand() * 0.08);
    const craterW = w * 0.09;

    ctx.fillStyle = this.hsl(colors[3], 1, -14);
    ctx.beginPath();
    ctx.moveTo(peakX - w * 0.28, baseY);
    ctx.lineTo(peakX - craterW, peakY);
    ctx.lineTo(peakX + craterW, peakY);
    ctx.lineTo(peakX + w * 0.28, baseY);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Coulées de lave
    ctx.strokeStyle = this.hsl({ h: 14, s: 90, l: 55 }, 0.9);
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const sx = peakX + (rand() - 0.5) * craterW;
      ctx.beginPath();
      ctx.moveTo(sx, peakY + 4);
      ctx.quadraticCurveTo(sx + (rand() - 0.5) * 30, (peakY + baseY) / 2, sx + (rand() - 0.5) * 50, baseY - 6);
      ctx.stroke();
    }

    // Lueur du cratère, pulsation
    const glowR = craterW * (1.4 + 0.3 * Math.abs(Math.sin(t * 2)));
    const glow = ctx.createRadialGradient(peakX, peakY, 2, peakX, peakY, glowR);
    glow.addColorStop(0, 'rgba(255,180,60,0.95)');
    glow.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(peakX, peakY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Braises qui montent
    for (let i = 0; i < 22; i++) {
      const ex = peakX + (rand() - 0.5) * craterW * 1.4;
      const rise = ((t * 40 * genome.flow) + i * 37) % 160;
      const ey = peakY - rise * 0.6;
      ctx.globalAlpha = Math.max(0, 1 - rise / 160);
      ctx.fillStyle = 'rgba(255,150,60,0.9)';
      ctx.fillRect(ex + Math.sin(t * 3 + i) * 6, ey, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  paintOcean(ctx, w, h, colors, genome, rand, t) {
    const waveBands = 5;
    for (let b = 0; b < waveBands; b++) {
      const yBase = h * (0.6 + b * 0.09);
      const amp = 5 + b * 3;
      const speed = t * genome.flow * (b + 1) * 0.9;
      ctx.fillStyle = this.hsl(colors[4], 0.9, -4 * b);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, yBase + Math.sin(x / 42 + speed + b * 1.6) * amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      if (b === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let x = 0; x <= w; x += 22) {
          const fy = yBase + Math.sin(x / 42 + speed) * amp;
          ctx.beginPath();
          ctx.ellipse(x + (rand() - 0.5) * 10, fy - 1, 6, 1.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  paintForest(ctx, w, h, colors, genome, rand, t) {
    const baseY = h * 0.82;
    ctx.fillStyle = this.hsl(colors[4], 1, -10);
    ctx.fillRect(0, baseY, w, h - baseY);

    for (let row = 0; row < 3; row++) {
      const rowY = baseY - row * h * 0.09;
      const count = 6 + Math.floor(rand() * 5);
      ctx.fillStyle = this.hsl(colors[3], 1, -6 - row * 8);
      for (let i = 0; i < count; i++) {
        const tx = (i + 0.5) / count * w + (rand() - 0.5) * 20;
        const th = h * (0.14 + rand() * 0.08) * (1 - row * 0.15);
        const tw = th * 0.55;
        const sway = Math.sin(t * genome.flow * 0.6 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(tx + sway, rowY - th);
        ctx.lineTo(tx - tw / 2, rowY);
        ctx.lineTo(tx + tw / 2, rowY);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Lucioles
    for (let i = 0; i < 14; i++) {
      const fx = (rand() * w + t * 10 * genome.flow + i * 23) % w;
      const fy = baseY - h * 0.1 - rand() * h * 0.25 + Math.sin(t * 2 + i) * 6;
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 3 + i));
      ctx.fillStyle = this.hsl({ h: 50, s: 80, l: 70 });
      ctx.fillRect(fx, fy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  paintHillsAndWaves(ctx, w, h, colors, genome, rand, t) {
    // Montagnes : deux crêtes superposées
    for (let layer = 0; layer < 2; layer++) {
      const baseY = h * (0.55 + layer * 0.12);
      const peaks = 3 + Math.floor(rand() * 3);
      ctx.fillStyle = this.hsl(colors[3], 1, -12 - layer * 10);
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, baseY + rand() * 20);
      for (let p = 0; p <= peaks; p++) {
        const px = (p + 0.5) / (peaks + 1) * w + (rand() - 0.5) * 30;
        const py = baseY - (0.12 + rand() * 0.22) * h;
        ctx.lineTo(px, py);
        ctx.lineTo((p + 1) / (peaks + 1) * w, baseY + rand() * 14);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    // Vagues / collines animées en bas
    const waveBands = 3;
    for (let b = 0; b < waveBands; b++) {
      const yBase = h * (0.78 + b * 0.07);
      const amp = 6 + b * 4;
      const speed = t * genome.flow * (b + 1) * 0.8;
      ctx.fillStyle = this.hsl(colors[4], 0.85, -6 * b);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, yBase + Math.sin(x / 46 + speed + b * 1.7) * amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---------- Entraînement évolutionnaire ---------- */

  score(genome) {
    const harmony = 1 - Math.abs(genome.hueSpread - 80) / 180;
    const contrast = 1 - Math.abs(genome.lightness - 50) / 50;
    const density = 1 - Math.abs(genome.shapes - 12) / 24;
    const texture = 1 - Math.abs(genome.noise - 0.2) / 0.6;
    const bonusSym = genome.symmetry ? 0.05 : 0;
    return Math.max(0, Math.min(1, (harmony * 0.35 + contrast * 0.25 + density * 0.25 + texture * 0.15) + bonusSym));
  }

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
    // La « maîtrise » grandit avec l'expérience ; les palettes apprises comptent.
    const skill = 1 - Math.exp(-this.stats.generations / 60);
    const paletteBonus = Math.min(0.1, this.stats.palettesLearned * 0.01);
    const effective = Math.min(1, bestScore * skill + paletteBonus);
    this.stats.bestScore = effective;
    this.save();
    return {
      generation: this.stats.generations,
      evaluated: candidates.length,
      score: effective
    };
  }

  /* ---------- Rendus ---------- */

  generateImage(subject, w = 480, h = 320) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    this.paint(canvas.getContext('2d'), w, h, this.genome, subject, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

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

  /* ---------- Paliers de progression ---------- */

  imageScore() {
    return this.stats.generations + this.stats.palettesLearned * 8 + Math.round(this.stats.bestScore * 50);
  }

  getMilestone() {
    const score = this.imageScore();
    let index = 0;
    for (let i = 0; i < IMAGE_TIERS.length; i++) {
      if (score >= IMAGE_TIERS[i].min) index = i;
    }
    const next = IMAGE_TIERS[index + 1] || null;
    return {
      index, score,
      name: IMAGE_TIERS[index].name,
      icon: IMAGE_TIERS[index].icon,
      next,
      remaining: next ? next.min - score : 0
    };
  }

  /* ---------- Partage & persistance ---------- */

  exportShared() {
    return { genome: this.genome, learnedPalettes: this.learnedPalettes, stats: this.stats };
  }

  mergeShared(data) {
    if (!data || !data.stats) return;
    for (const kw in (data.learnedPalettes || {})) {
      if (!this.learnedPalettes[kw]) this.learnedPalettes[kw] = data.learnedPalettes[kw];
    }
    this.stats.palettesLearned = Math.max(this.stats.palettesLearned, data.stats.palettesLearned || 0);
    if ((data.stats.generations || 0) > this.stats.generations) {
      if (data.genome) this.genome = data.genome;
      this.stats.generations = data.stats.generations;
      this.stats.candidatesEvaluated = Math.max(this.stats.candidatesEvaluated, data.stats.candidatesEvaluated || 0);
      this.stats.bestScore = Math.max(this.stats.bestScore, data.stats.bestScore || 0);
    }
  }

  save() {
    try {
      localStorage.setItem(VISION_STORAGE_KEY, JSON.stringify({
        genome: this.genome,
        learnedPalettes: this.learnedPalettes,
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
      if (data.learnedPalettes) this.learnedPalettes = data.learnedPalettes;
      if (data.stats) this.stats = Object.assign(this.stats, data.stats);
      return true;
    } catch (e) {
      return false;
    }
  }
}

window.Vision = Vision;
