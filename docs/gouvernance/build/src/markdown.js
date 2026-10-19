// Markdown (sous-ensemble utilisé dans docs/gouvernance) → paragraphes et tableaux Word
// Gère : titres #, ##, ###, paragraphes, tableaux, citations >, listes à puces et numérotées
const { Paragraph, TextRun, HeadingLevel, BorderStyle } = require('docx');
const theme = require('./theme');
const { runs, plain } = require('./inline');
const { table } = require('./table');
const { BULLETS, NUMBERS } = require('./styles');

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

function quote(text) {
  return new Paragraph({
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: theme.colors.line, space: 8 } },
    indent: { left: 360 },
    spacing: { after: 120 },
    children: runs(text, { italics: true, color: theme.colors.mid }),
  });
}

const listLevel = (indent) => (indent.length >= 2 ? 1 : 0);

// Chaque liste numérotée doit repartir à 1 : on lui donne une instance de numérotation unique
// dans tout le document, d'où un compteur partagé entre les appels à convert.
function createConverter() {
  let numberingInstance = 0;

  return function convert(md, { pageBreakBeforeH1 = false } = {}) {
    const out = [];
    const lines = md.split('\n');
    let i = 0, paragraph = [], currentList = null;

    const flushParagraph = () => {
      if (paragraph.length) out.push(new Paragraph({ spacing: { after: 120 }, children: runs(paragraph.join(' ')) }));
      paragraph = [];
    };
    const endBlock = () => { flushParagraph(); currentList = null; };

    while (i < lines.length) {
      const line = lines[i];
      const t = line.trim();
      let m;

      if (!t || /^-{3,}$/.test(t)) { endBlock(); i++; continue; }

      if ((m = /^(#{1,3})\s+(.*)$/.exec(t))) {
        endBlock();
        const level = m[1].length;
        out.push(new Paragraph({
          heading: HEADINGS[level - 1],
          pageBreakBefore: level === 1 && pageBreakBeforeH1,
          children: [new TextRun(plain(m[2]))],
        }));
        i++; continue;
      }

      if (t.startsWith('|')) {
        endBlock();
        const block = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) block.push(lines[i++]);
        out.push(table(block));
        out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        continue;
      }

      if (t.startsWith('>')) {
        endBlock();
        // Une citation = suite de lignes « > » ; une ligne « > » vide sépare deux paragraphes
        let buffer = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          const q = lines[i].trim().replace(/^>\s?/, '');
          if (!q) { if (buffer.length) out.push(quote(buffer.join(' '))); buffer = []; } else buffer.push(q);
          i++;
        }
        if (buffer.length) out.push(quote(buffer.join(' ')));
        continue;
      }

      if ((m = /^(\s*)[-*]\s+(.*)$/.exec(line))) {
        flushParagraph();
        out.push(new Paragraph({ numbering: { reference: BULLETS, level: listLevel(m[1]) }, spacing: { after: 60 }, children: runs(m[2]) }));
        i++; continue;
      }

      if ((m = /^(\s*)\d+\.\s+(.*)$/.exec(line))) {
        flushParagraph();
        if (currentList === null) currentList = ++numberingInstance;
        out.push(new Paragraph({
          numbering: { reference: NUMBERS, level: listLevel(m[1]), instance: currentList },
          spacing: { after: 60 },
          children: runs(m[2]),
        }));
        i++; continue;
      }

      paragraph.push(t); i++;
    }
    flushParagraph();
    return out;
  };
}

module.exports = { createConverter };
