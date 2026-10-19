# Scénario B — injection applicative (WOR-59)

But : démontrer qu'on distingue disponibilité (A) et intégrité (B).
Vecteur : entrée malformée abusée contre l'API métier.

Réponse attendue (≠ A) : blocage WAF + rollback snapshot BDD propre + rotation du secret ;
preuve = transaction OK ET intégrité des données vérifiée.

Critère d'acceptation : déclenche les règles WAF (ModSecurity CRS SQLi 942xxx)
et produit un signal étiquetable (famille ML `injection`, cf `docs/attack-scenarios.md`).

Les vecteurs sont des **signatures de test** destinées à être bloquées, pas des
exploits fonctionnels.

Usage (`attack-b.sh`) :

    ./attack-b.sh --target <host> --path /api/pay --param q --rounds 3 --delay 1

Garde-fou périmètre (WOR-66) : refuse toute cible non privée (seuls localhost /
RFC1918 sur RESILIENCE-G6).
