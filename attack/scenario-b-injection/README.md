# Scénario B — injection applicative (WOR-59)

But : démontrer qu'on distingue disponibilité (A) et intégrité (B).
Vecteur : entrée malformée abusée contre l'API métier.

Réponse attendue (≠ A) : blocage WAF + rollback snapshot BDD propre + rotation du secret ;
preuve = transaction OK ET intégrité des données vérifiée.
