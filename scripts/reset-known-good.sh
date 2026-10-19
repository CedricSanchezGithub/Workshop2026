#!/usr/bin/env bash
# reset-known-good — WOR-90 (à implémenter)
#
# Remet la plateforme dans un état sain connu entre les répétitions et avant le jury.
# Idempotent : même résultat quel que soit l'état de départ.
#
# Étapes prévues :
#   1. Arrêt propre des conteneurs
#   2. Restauration des données de seed (BDD)
#   3. Purge des effets de l'attaque (rate-limits, blocages WAF, conteneurs quarantainés)
#   4. Rotation des secrets si le scénario B a été joué
#   5. Vérification de santé : API OK, transaction test OK, données cohérentes (cf WOR-77)
set -euo pipefail

echo "TODO: implementer la remise a l'etat sain (WOR-90)"
