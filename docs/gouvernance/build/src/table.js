// Tableaux Markdown → tableaux Word
const { Paragraph, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle } = require('docx');
const theme = require('./theme');
const { runs, plain } = require('./inline');

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: theme.colors.line };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

const isSeparator = (line) => /^\|\s*:?-{2,}/.test(line.trim());
const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

// Largeur mini = mot le plus long (jamais coupé) ; le reste réparti selon la longueur du contenu
const CHAR = 100, PAD = 260;
function columnWidths(rows, total) {
  const n = rows[0].length;
  const column = (i) => rows.map((r) => plain(r[i] || ''));
  const min = Array.from({ length: n }, (_, i) =>
    Math.max(...column(i).flatMap((c) => c.split(/\s+/)).map((w) => w.length)) * CHAR + PAD);
  const want = Array.from({ length: n }, (_, i) =>
    Math.min(Math.max(...column(i).map((c) => c.length)), 70) * CHAR + PAD);
  let out = min.slice();
  const free = total - out.reduce((a, b) => a + b, 0);
  if (free > 0) {
    const extra = want.map((w, i) => Math.max(w - min[i], 0));
    const sumExtra = extra.reduce((a, b) => a + b, 0) || 1;
    out = out.map((w, i) => w + Math.floor((free * extra[i]) / sumExtra));
  } else {
    out = out.map((w) => Math.floor((w * total) / (total - free)));
  }
  out[n - 1] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

function table(lines) {
  const rows = lines.filter((l) => !isSeparator(l)).map(splitRow);
  const total = theme.contentWidth;
  const widths = columnWidths(rows, total);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, ri) => new TableRow({
      tableHeader: ri === 0,
      cantSplit: true,
      children: widths.map((w, ci) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders,
        shading: ri === 0 ? { fill: theme.colors.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ children: runs(r[ci] || '', { size: theme.size.table, bold: ri === 0 || undefined }) })],
      })),
    })),
  });
}

module.exports = { table };
