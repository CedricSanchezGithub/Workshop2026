$ErrorActionPreference = 'Stop'

docker compose -f infra/docker-compose.yml up -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Impossible de démarrer PostgreSQL.' }

for ($attempt = 1; $attempt -le 30; $attempt++) {
  docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U payandgo -d payandgo *> $null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
  if ($attempt -eq 30) { throw 'PostgreSQL n’est pas prêt après 60 secondes.' }
}

$schemaPath = Join-Path (Get-Location) 'infra/database/init/001_schema.sql'
Get-Content -Raw $schemaPath | docker compose -f infra/docker-compose.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U payandgo -d payandgo
if ($LASTEXITCODE -ne 0) { throw 'Le script SQL d’initialisation a échoué.' }

Write-Host 'Schéma Pay&Go initialisé dans PostgreSQL.'
