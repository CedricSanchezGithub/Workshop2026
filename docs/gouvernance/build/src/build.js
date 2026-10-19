// Point d'entrée : lit les .md, génère le .docx
// Usage : npm run build [-- <fichier de sortie>]
const fs = require('fs');
const path = require('path');
const { Packer } = require('docx');
const config = require('./config');
const { buildDocument } = require('./document');

const read = (file) => fs.readFileSync(file, 'utf8');

async function main() {
  const output = process.argv[2] ? path.resolve(process.argv[2]) : config.outputFile;
  const doc = buildDocument({
    config,
    cover: read(config.coverFile),
    parts: config.parts.map((f) => read(path.join(config.sourceDir, f))),
  });
  fs.writeFileSync(output, await Packer.toBuffer(doc));
  console.log('écrit :', output);
}

main().catch((err) => { console.error(err); process.exit(1); });
