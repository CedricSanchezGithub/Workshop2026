// Dossiers à générer : quels .md, dans quel ordre, où écrire les PDF
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

module.exports = {
  // Hors de docs/ : le RAG indexe docs/**/*.pdf, un PDF dans docs/ ferait doublon avec les .md
  outputRoot: path.join(ROOT, 'livrables'),
  dossiers: [
    {
      id: 'gouvernance',
      title: 'Workshop 2026 — Groupe 6',
      subtitle: 'PROJECT RESILIENCE-ALPHA · Dossier de gouvernance — état au 20/10/2026',
      sourceDir: path.join(ROOT, 'docs', 'gouvernance'),
      cover: path.join(__dirname, '..', 'cover-gouvernance.md'),
      fullName: 'Workshop2026-G6-Gouvernance',
      // Une partie par fichier, dans l'ordre du dossier ; chacune donne aussi un PDF seul
      parts: [
        { source: 'cible/ebios-rm.md', name: 'EBIOS-RM' },
        { source: 'cible/services-critiques.md', name: 'Services-critiques' },
        { source: 'cible/nis2-dora.md', name: 'NIS2-DORA' },
        { source: 'cible/rto-rpo.md', name: 'RTO-RPO' },
        { source: 'cible/pca-pra.md', name: 'PCA-PRA' },
        { source: 'cible/recommandations.md', name: 'Recommandations' },
        { source: 'constat/etat-implementation.md', name: 'Etat-implementation' },
      ],
    },
  ],
};
