# Scénario A — DoS / épuisement de ressources (WOR-58)

But : rendre l'API de paiement indisponible via un effet réel et observable
(latence / erreurs), détectable par la supervision.

Réponse attendue : restauration de la disponibilité (rate-limit WAF, redémarrage/scale, Ansible).
Critère d'acceptation : produit un signal mesurable et étiquetable dans Prometheus/Loki.

Usage prévu (à implémenter) :

    ./attack-a.sh --target <host> --intensity <n> --duration <sec>
