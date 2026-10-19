// Markdown → HTML
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({ html: false, typographer: false });

// WOR-31, REC-1, R1… ne sont jamais coupés en fin de ligne
const ID = /\b([A-Z]{1,4}-\d+)\b/g;
md.renderer.rules.text = (tokens, idx) =>
  md.utils.escapeHtml(tokens[idx].content).replace(ID, '<span class="id">$1</span>');

const toHtml = (source) => md.render(source);

module.exports = { toHtml };
