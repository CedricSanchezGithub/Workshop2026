// Assemblage du document : page de garde, parties, mise en page, pied de page
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Footer, PageNumber } = require('docx');
const theme = require('./theme');
const { styles, numbering } = require('./styles');
const { createConverter } = require('./markdown');

function coverHeader({ title, subtitle }) {
  return [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
    new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: subtitle, italics: true, color: theme.colors.mid, size: theme.size.subtitle })] }),
  ];
}

function footer() {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
    new TextRun({ children: ['Page ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: theme.size.footer, color: theme.colors.mid }),
  ] })] });
}

// cover : Markdown de la page de garde ; parts : Markdown de chaque partie, dans l'ordre
function buildDocument({ config, cover, parts }) {
  const convert = createConverter();
  const { width, height, margin } = theme.page;
  return new Document({
    creator: config.creator,
    title: config.metadataTitle,
    styles,
    numbering,
    sections: [{
      properties: { page: { size: { width, height }, margin: { top: margin, right: margin, bottom: margin, left: margin } } },
      footers: { default: footer() },
      children: [
        ...coverHeader(config),
        ...convert(cover),
        ...parts.flatMap((md) => convert(md, { pageBreakBeforeH1: true })),
      ],
    }],
  });
}

module.exports = { buildDocument };
