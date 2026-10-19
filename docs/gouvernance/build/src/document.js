// Assemblage des documents : page de garde, parties, mise en page, pied de page
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Footer, PageNumber } = require('docx');
const theme = require('./theme');
const { styles, numbering } = require('./styles');
const { createConverter } = require('./markdown');
const { plain } = require('./inline');

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

function wordDocument({ creator, title, children }) {
  const { width, height, margin } = theme.page;
  return new Document({
    creator,
    title,
    styles,
    numbering,
    sections: [{
      properties: { page: { size: { width, height }, margin: { top: margin, right: margin, bottom: margin, left: margin } } },
      footers: { default: footer() },
      children,
    }],
  });
}

// Dossier complet. cover : Markdown de la page de garde ; parts : Markdown de chaque partie, dans l'ordre
function buildDossier({ config, cover, parts }) {
  const convert = createConverter();
  return wordDocument({
    creator: config.creator,
    title: config.metadataTitle,
    children: [
      ...coverHeader(config),
      ...convert(cover),
      ...parts.flatMap((md) => convert(md, { pageBreakBeforeH1: true })),
    ],
  });
}

// Une partie seule, sans page de garde ; le titre du document est son premier titre #
function buildPart({ config, md }) {
  const h1 = /^#\s+(.*)$/m.exec(md);
  return wordDocument({
    creator: config.creator,
    title: h1 ? plain(h1[1]) : config.metadataTitle,
    children: createConverter()(md),
  });
}

module.exports = { buildDossier, buildPart };
