// Styles Word du document : polices, titres, listes
const { LevelFormat, AlignmentType } = require('docx');
const theme = require('./theme');

const BULLETS = 'bullets';
const NUMBERS = 'numbers';

const heading = (id, name, size, color, before, after, outlineLevel) => ({
  id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
  run: { size, bold: true, color },
  paragraph: { spacing: { before, after }, outlineLevel, keepNext: true },
});

const styles = {
  default: { document: { run: { font: theme.font.body, size: theme.size.body } } },
  paragraphStyles: [
    { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: theme.font.body, size: 44, bold: true, color: theme.colors.dark }, paragraph: { spacing: { after: 120 } } },
    heading('Heading1', 'Heading 1', 32, theme.colors.dark, 360, 160, 0),
    heading('Heading2', 'Heading 2', 26, theme.colors.dark, 280, 120, 1),
    heading('Heading3', 'Heading 3', 22, theme.colors.mid, 200, 100, 2),
  ],
};

const level = (lvl, format, text) => ({
  level: lvl, format, text, alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 720 * (lvl + 1), hanging: 360 } } },
});

const numbering = {
  config: [
    { reference: BULLETS, levels: [level(0, LevelFormat.BULLET, '•'), level(1, LevelFormat.BULLET, '–')] },
    { reference: NUMBERS, levels: [level(0, LevelFormat.DECIMAL, '%1.'), level(1, LevelFormat.LOWER_LETTER, '%2)')] },
  ],
};

module.exports = { styles, numbering, BULLETS, NUMBERS };
