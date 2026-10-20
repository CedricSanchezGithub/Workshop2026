// Site de documentation du pilier Gouvernance (Astro + Starlight)
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Pour chaque thème : d'abord la notion générale, puis le document du projet
const theme = (label, items) => ({ label, items });
const notion = (slug, label) => ({ slug: `notions/${slug}`, label });
const doc = (slug, label = 'Notre analyse') => ({ slug, label });

export default defineConfig({
  integrations: [
    starlight({
      title: 'Gouvernance — Groupe 6',
      description: 'PROJECT RESILIENCE-ALPHA : risques, réglementation, continuité et reprise',
      defaultLocale: 'root',
      locales: { root: { label: 'Français', lang: 'fr' } },
      customCss: ['./src/styles/charte.css'],
      sidebar: [
        { label: 'Accueil', link: '/' },
        theme('Analyse de risques (EBIOS RM)', [
          notion('ebios-rm', "Qu'est-ce qu'EBIOS RM ?"),
          doc('cible/ebios-rm'),
        ]),
        theme('Services critiques', [doc('cible/services-critiques', "Coût d'un arrêt et priorités")]),
        theme('Réglementation (NIS2, DORA)', [
          notion('dora', "Qu'est-ce que DORA ?"),
          notion('nis2', "Qu'est-ce que NIS2 ?"),
          doc('cible/nis2-dora'),
        ]),
        theme('Objectifs de reprise (RTO, RPO)', [
          notion('rto-rpo', "Qu'est-ce que le RTO et le RPO ?"),
          doc('cible/rto-rpo', 'Nos objectifs'),
        ]),
        theme('Continuité et reprise (PCA, PRA)', [
          notion('pca-pra', "Qu'est-ce qu'un PCA / PRA ?"),
          doc('cible/pca-pra', 'Notre plan'),
        ]),
        theme('Recommandations', [doc('cible/recommandations', 'Recommandations à la direction')]),
        theme('Constat', [doc('constat/etat-implementation', "État d'implémentation")]),
        theme('Autre', [
          doc('autre/rediger-pour-le-rag', 'Rédiger pour le RAG'),
          doc('autre/generer-les-pdf', 'Générer les PDF'),
          doc('autre/site', 'Le site de documentation'),
        ]),
      ],
    }),
  ],
});
