# Démo MFA faciale + LED ESP8266 (consigne additionnelle 1)

## Le principe

Le back-office demande l'email, puis le visage, puis le mot de passe. Chaque étape change un
« signal » côté API ; l'ESP8266 lit ce signal toutes les 0,4 s et allume la LED en conséquence.

```
Navigateur (PC Hôte, caméra USB)          ESP8266 (même WiFi)
        │ email → visage → mot de passe          │ GET /v1/device/led toutes les 0,4 s
        ▼                                         ▼
      WAF  http://<IP du PC Hôte>:8080  ◄─────────┘
        ▼
   back-office (API) ──► reconnaissance faciale
```

| Ce qui se passe | LED |
|---|---|
| Visage reconnu, en attente du mot de passe | vert clignotant |
| Mot de passe correct | vert fixe 30 s |
| Mot de passe erroné | rouge, 10 clignotements |
| Visage non reconnu (ou compte verrouillé) | rouge fixe 30 s |

Après 2 échecs, l'identifiant est verrouillé 5 minutes.

## Matériel

- PC Hôte avec la plateforme démarrée (`scripts/setup.sh`) et une caméra USB.
- NodeMCU ESP8266 + câble USB **de données**.
- Une LED bicolore à 3 broches + 2 résistances ~330 Ω : vert → **D1**, rouge → **D2**, broche
  commune (la plus longue) → **GND**. Si la LED reste allumée au repos ou si les couleurs sont
  inversées, c'est une LED à anode commune : broche commune sur **3V3** et `COMMON_ANODE 1`
  dans `iot/led-indicator/include/config.h`.
- Un WiFi **2,4 GHz** (l'ESP8266 ne voit pas le 5 GHz), partagé par le PC Hôte et l'ESP.

## Une seule fois sur le PC Hôte

```bash
sudo apt remove brltty     # sinon il capte la puce USB de la carte (pas de /dev/ttyUSB0)
```

## Le jour de la démo

Depuis la racine du dépôt, PC Hôte connecté au WiFi de la démo :

| # | Commande | Ce qu'elle fait |
|---|---|---|
| 1 | `scripts/demo-led.sh publish` | Publie le WAF sur l'IP WiFi du PC Hôte et vérifie que le canal LED répond |
| 2 | `scripts/demo-led.sh flash` | Demande le WiFi, écrit l'URL du canal dans le firmware, flashe la carte (branchée en USB) |
| 3 | `scripts/demo-led.sh test` | Sans caméra : la LED clignote rouge, puis passe au vert fixe |
| 4 | `scripts/demo-start.sh` | Lance l'interface web |

L'étape 2 n'est à refaire que si l'IP du PC Hôte ou le WiFi change. L'IP détectée est affichée ;
pour en forcer une autre : `scripts/demo-led.sh publish 192.168.137.1` (idem pour `flash`).

> ⚠️ L'API limite à **12 appels d'authentification par 15 minutes** (inscription, vérification
> faciale, connexion), et le navigateur et les scripts du PC Hôte partagent ce quota. La
> préparation + le scénario du jury en consomment ~9, `test` 3 de plus : lancer `test` **au
> moins 15 minutes avant** le passage devant le jury.

Ensuite, dans un navigateur **sur le PC Hôte**, ouvrir **http://localhost:5173** (pas l'IP :
le navigateur bloque la caméra hors `localhost`) :

1. **Créer un compte** `admin@resilience-alpha.local` (cet email reçoit le rôle admin).
2. **Administration** → *Habilitations faciales* : enrôler le visage du compte (2-3 captures).
3. Se déconnecter.

> Les comptes sont gardés en mémoire : après un redémarrage de l'API, refaire ces 3 étapes.

## Le scénario devant le jury

| Action | Écran | LED |
|---|---|---|
| Email de l'admin, puis *Confirmer mon identité* | champ mot de passe | vert clignotant |
| Bon mot de passe | back-office | vert fixe 30 s |
| Se reconnecter, mauvais mot de passe | retour à l'email | rouge, 10 clignotements |
| Se reconnecter, une **autre personne** devant la caméra | retour à l'email | rouge fixe 30 s |
| Refaire le refus une 2e fois | « Trop de tentatives » | rouge fixe 30 s |

Après la dernière ligne, l'identifiant est verrouillé 5 minutes : la jouer en dernier.
Un visage caché (aucun visage détecté) ne compte pas comme un refus : la LED ne bouge pas.

## Dépannage

| Symptôme | Solution |
|---|---|
| `publish` : le canal ne répond pas | La plateforme ne tourne pas : `scripts/setup.sh` |
| `flash` : « Aucune carte détectée » | Câble de données (pas de charge seule) ; `sudo apt remove brltty` puis rebrancher |
| `flash` : « Failed to connect » | Maintenir **FLASH**, appuyer sur **RST**, relâcher RST puis FLASH, relancer |
| La LED ne réagit pas | Journal série : `pio device monitor -d iot/led-indicator`. `[wifi] echec` : mauvais WiFi ou réseau 5 GHz. `[wifi] OK` sans `[led]` : refaire `publish` puis `flash` (l'IP a changé) |
| `test` ne fait rien et l'API répond 429 | Limite de 12 connexions / 15 min par IP : attendre |
| Visage toujours refusé | Ré-enrôler : visage de face, bien éclairé, plusieurs captures |
| « Trop de tentatives » | Identifiant verrouillé 5 minutes : attendre, ou utiliser un autre compte |

## Après la démo

```bash
scripts/demo-led.sh local   # le WAF n'écoute plus que sur 127.0.0.1
```
