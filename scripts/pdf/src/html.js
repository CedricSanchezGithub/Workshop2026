// Assemblage des pages HTML à imprimer : dossier complet ou partie seule
const fs = require('fs');
const path = require('path');
const { toHtml } = require('./markdown');

const css = fs.readFileSync(path.join(__dirname, 'theme.css'), 'utf8');
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const firstHeading = (source) => (/^#\s+(.*)$/m.exec(source) || [])[1] || '';

function page(title, body) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${css}</style></head>
<body>${body}</body></html>`;
}

// Page de garde, puis une section par partie
function dossierPage(dossier, cover, parts) {
  const body = [
    `<p class="title">${escape(dossier.title)}</p>`,
    `<p class="subtitle">${escape(dossier.subtitle)}</p>`,
    toHtml(cover),
    ...parts.map((source) => `<section class="part">${toHtml(source)}</section>`),
  ].join('\n');
  return page(`${dossier.title} — ${dossier.subtitle}`, body);
}

// Une partie seule, sans page de garde ; le titre du PDF est son premier titre #
function partPage(source) {
  return page(firstHeading(source), toHtml(source));
}

module.exports = { dossierPage, partPage };
