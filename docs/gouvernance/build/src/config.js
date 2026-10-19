// Contenu du dossier : quels fichiers, dans quel ordre, avec quel titre
const path = require('path');

const GOUVERNANCE_DIR = path.resolve(__dirname, '..', '..');

module.exports = {
  sourceDir: GOUVERNANCE_DIR,
  coverFile: path.resolve(__dirname, '..', 'cover.md'),
  outputFile: path.join(GOUVERNANCE_DIR, 'Workshop2026-G6-Gouvernance.docx'),
  // Une partie par fichier, chacune commence sur une nouvelle page
  parts: [
    'ebios-rm.md',
    'services-critiques.md',
    'nis2-dora.md',
    'rto-rpo.md',
    'pca-pra.md',
    'recommandations.md',
  ],
  title: 'Workshop 2026 — Groupe 6',
  subtitle: 'PROJECT RESILIENCE-ALPHA · Dossier de gouvernance — état au 19/10/2026',
  metadataTitle: 'Workshop 2026 — Groupe 6 — Dossier de gouvernance',
  creator: 'Groupe 6',
};
