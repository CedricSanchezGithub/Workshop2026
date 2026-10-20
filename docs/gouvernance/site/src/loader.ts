// Charge les .md de docs/gouvernance tels quels, sans les modifier ni les copier :
// le titre de la page est le premier titre « # » du fichier, retiré du corps
// (Starlight l'affiche déjà en haut de la page).
import type { Loader } from 'astro/loaders';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Dossiers publiés, dans l'ordre ; le README du dossier sert de page d'accueil
const SECTIONS = ['notions', 'cible', 'constat'];
const HOME = { path: 'README.md', id: 'index' };

async function listFiles(base: string) {
  const files = [HOME];
  for (const section of SECTIONS) {
    const names = (await readdir(new URL(`${section}/`, base))).filter((n) => n.endsWith('.md')).sort();
    files.push(...names.map((n) => ({ path: `${section}/${n}`, id: `${section}/${n.slice(0, -3)}` })));
  }
  return files;
}

function splitTitle(source: string, fallback: string) {
  const heading = /^#\s+(.+)\n/m.exec(source);
  if (!heading) return { title: fallback, body: source };
  return { title: heading[1].trim(), body: source.replace(heading[0], '') };
}

export function gouvernanceLoader(base: URL): Loader {
  return {
    name: 'gouvernance-loader',
    async load({ store, parseData, renderMarkdown, watcher }) {
      store.clear();
      watcher?.add(fileURLToPath(base));
      for (const { path, id } of await listFiles(base.href)) {
        const fileURL = new URL(path, base);
        const { title, body } = splitTitle(await readFile(fileURL, 'utf8'), id);
        store.set({
          id,
          data: await parseData({ id, data: { title } }),
          body,
          rendered: await renderMarkdown(body, { fileURL }),
        });
      }
    },
  };
}
