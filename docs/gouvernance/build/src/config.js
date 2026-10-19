// Contenu du dossier : quels fichiers, dans quel ordre, avec quel titre
const path = require('path');

const GOUVERNANCE_DIR = path.resolve(__dirname, '..', '..');

module.exports = {
  sourceDir: path.join(GOUVERNANCE_DIR, 'rag'), // .md sources, aussi indexés par l'assistant RAG
  coverFile: path.resolve(__dirname, '..', 'cover.md'),
  outputFile: path.join(GOUVERNANCE_DIR, 'Workshop2026-G6-Gouvernance.docx'),
  // Un .docx par partie, nommé <numéro>-<nom>.docx
  partsOutputDir: path.join(GOUVERNANCE_DIR, 'docx'),
  // Une partie par fichier, dans l'ordre du dossier ; chacune commence sur une nouvelle page
  parts: [
    { source: 'ebios-rm.md', name: 'EBIOS-RM' },
    { source: 'services-critiques.md', name: 'Services-critiques' },
    { source: 'nis2-dora.md', name: 'NIS2-DORA' },
    { source: 'rto-rpo.md', name: 'RTO-RPO' },
    { source: 'pca-pra.md', name: 'PCA-PRA' },
    { source: 'recommandations.md', name: 'Recommandations' },
  ],
  title: 'Workshop 2026 — Groupe 6',
  subtitle: 'PROJECT RESILIENCE-ALPHA · Dossier de gouvernance — état au 19/10/2026',
  metadataTitle: 'Workshop 2026 — Groupe 6 — Dossier de gouvernance',
  creator: 'Groupe 6',
};
