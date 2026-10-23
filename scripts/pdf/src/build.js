// Point d'entrée : pour chaque dossier, un PDF complet et un PDF par partie
// Usage : npm run build
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { dossierPage, partPage } = require('./html');
const { openPrinter } = require('./chrome');

const read = (file) => fs.readFileSync(file, 'utf8');

// Images PNG/JPEG du Markdown intégrées en data: URI (la page est chargée sans URL de base)
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const inlineImages = (source, dir) =>
  source.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (all, alt, src) => {
    const mime = MIME[path.extname(src).toLowerCase()];
    if (!mime || /^[a-z]+:/i.test(src)) return all;
    return `![${alt}](data:${mime};base64,${fs.readFileSync(path.join(dir, src)).toString('base64')})`;
  });
const number = (i) => String(i + 1).padStart(2, '0');

async function main() {
  const printer = await openPrinter();
  try {
    for (const dossier of config.dossiers) {
      const outDir = path.join(config.outputRoot, dossier.id);
      fs.mkdirSync(outDir, { recursive: true });
      const parts = dossier.parts.map((p) => {
        const file = path.join(dossier.sourceDir, p.source);
        return { ...p, md: inlineImages(read(file), path.dirname(file)) };
      });

      const cover = dossier.cover ? read(dossier.cover) : '';
      const outputs = [[dossierPage(dossier, cover, parts.map((p) => p.md)), `${dossier.fullName}.pdf`]];
      if (dossier.partPdfs !== false) outputs.push(...parts.map((p, i) => [partPage(p.md), `${number(i)}-${p.name}.pdf`]));
      for (const [html, name] of outputs) {
        const file = path.join(outDir, name);
        await printer.print(html, file);
        console.log('écrit :', path.relative(process.cwd(), file));
      }
    }
  } finally {
    await printer.close();
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
