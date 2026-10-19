// Point d'entrée : lit les .md, génère le dossier complet et un .docx par partie
// Usage : npm run build
const fs = require('fs');
const path = require('path');
const { Packer } = require('docx');
const config = require('./config');
const { buildDossier, buildPart } = require('./document');

const read = (file) => fs.readFileSync(file, 'utf8');

async function write(doc, file) {
  fs.writeFileSync(file, await Packer.toBuffer(doc));
  console.log('écrit :', path.relative(process.cwd(), file));
}

async function main() {
  const parts = config.parts.map((part, i) => ({
    md: read(path.join(config.sourceDir, part.source)),
    output: `${String(i + 1).padStart(2, '0')}-${part.name}.docx`,
  }));

  await write(buildDossier({ config, cover: read(config.coverFile), parts: parts.map((p) => p.md) }), config.outputFile);

  fs.mkdirSync(config.partsOutputDir, { recursive: true });
  for (const { md, output } of parts) {
    await write(buildPart({ config, md }), path.join(config.partsOutputDir, output));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
