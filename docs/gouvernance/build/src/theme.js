// Charte graphique et dimensions de page (unités Word : DXA, 1 cm ≈ 567 ; tailles en demi-points)
module.exports = {
  colors: {
    dark: '261E48', // titres
    mid: '4A4470', // sous-titres, citations
    line: 'A1A6D4', // bordures
    fill: 'E4E6F3', // en-têtes de tableau
  },
  font: { body: 'Calibri', code: 'Menlo' },
  size: { body: 21, table: 18, code: 19, footer: 16, subtitle: 24 },
  page: { width: 11906, height: 16838, margin: 1134 }, // A4, marges de 2 cm
  get contentWidth() {
    return this.page.width - 2 * this.page.margin;
  },
};
