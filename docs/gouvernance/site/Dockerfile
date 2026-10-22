# Site de documentation de la gouvernance (Astro + Starlight), servi en statique par nginx.
# Contexte de construction : docs/gouvernance (le site lit les .md du dossier parent).
#   docker compose -f docs/gouvernance/site/docker-compose.yml up --build

FROM node:25-alpine AS build
WORKDIR /gouvernance/site
COPY site/package.json site/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY site/ ./
COPY README.md /gouvernance/README.md
COPY notions/ /gouvernance/notions/
COPY cible/ /gouvernance/cible/
COPY constat/ /gouvernance/constat/
COPY autre/ /gouvernance/autre/
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY --from=build /gouvernance/site/dist /usr/share/nginx/html
EXPOSE 8080
