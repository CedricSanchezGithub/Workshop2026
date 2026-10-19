// Mise en forme dans une ligne : **gras**, `code`, identifiants insécables
const { TextRun } = require('docx');
const theme = require('./theme');

// WOR-31, REC-1… : tiret insécable pour ne jamais couper l'identifiant en fin de ligne
const keepIdsTogether = (text) => text.replace(/\b([A-Z]{1,4})-(\d)/g, '$1‑$2');

// Texte sans balisage, pour les titres et le calcul des largeurs de colonnes
const plain = (text) => text.replace(/\*\*/g, '').replace(/`/g, '');

function runs(text, base = {}) {
  const source = keepIdsTogether(text);
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(source))) {
    if (m.index > last) out.push(new TextRun({ text: source.slice(last, m.index), ...base }));
    const token = m[0];
    if (token.startsWith('**')) {
      out.push(new TextRun({ text: token.slice(2, -2), ...base, bold: true }));
    } else {
      out.push(new TextRun({ text: token.slice(1, -1), ...base, font: theme.font.code, size: base.size ? base.size - 1 : theme.size.code }));
    }
    last = m.index + token.length;
  }
  if (last < source.length) out.push(new TextRun({ text: source.slice(last), ...base }));
  return out;
}

module.exports = { runs, plain };
