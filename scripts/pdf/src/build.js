// Point d'entrée : pour chaque dossier, un PDF complet et un PDF par partie
// Usage : npm run build
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { dossierPage, partPage } = require('./html');
const { openPrinter } = require('./chrome');

const read = (file) => fs.readFileSync(file, 'utf8');
const number = (i) => String(i + 1).padStart(2, '0');

async function main() {
  const printer = await openPrinter();
  try {
    for (const dossier of config.dossiers) {
      const outDir = path.join(config.outputRoot, dossier.id);
      fs.mkdirSync(outDir, { recursive: true });
      const parts = dossier.parts.map((p) => ({ ...p, md: read(path.join(dossier.sourceDir, p.source)) }));

      const outputs = [
        [dossierPage(dossier, read(dossier.cover), parts.map((p) => p.md)), `${dossier.fullName}.pdf`],
        ...parts.map((p, i) => [partPage(p.md), `${number(i)}-${p.name}.pdf`]),
      ];
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
