# iot/led-indicator — ESP8266 LED bicolore (WOR-99)

Objet connecté de la consigne additionnelle 1 : une LED rouge/vert reflète en temps réel
l'état du flux d'authentification du back-office.

**IDE imposé : JetBrains CLion + PlatformIO.** Carte : NodeMCU v2 (ESP8266).

## Machine à états de la LED

Pilotée par le canal `GET /v1/device/led` du back-office (WOR-100), qui renvoie
`{ signal, seq }`. Le firmware réagit à chaque changement de `seq` :

| `signal` | LED | Déclencheur côté auth |
|---|---|---|
| `idle` | éteinte | repos |
| `recognized` | **vert clignotant** | visage reconnu, en attente du mot de passe |
| `granted` | **vert fixe 30 s** puis éteint | mot de passe validé |
| `denied` | **rouge clignote 10 fois** puis éteint | mot de passe erroné |
| `rejected` | **rouge fixe 30 s** puis éteint | visage non reconnu / verrou |

Motifs **non bloquants** (`millis()`) : le WiFi et le poll restent réactifs, et un nouvel
évènement interrompt le motif en cours.

## Câblage

LED bicolore à cathode commune : `GREEN_PIN=D1` (GPIO5), `RED_PIN=D2` (GPIO4), cathode au GND
via une résistance (~330 Ω par anode). Modifiable dans `config.h`.

## Configuration

```bash
cp include/config.example.h include/config.h
# puis renseigner WIFI_SSID / WIFI_PASSWORD / LED_ENDPOINT / DEVICE_TOKEN
```

`config.h` est ignoré par Git (aucun secret dans le dépôt). `LED_ENDPOINT` pointe sur le WAF
(point d'entrée du groupe) : `http://192.168.137.1:8080/v1/device/led` le jour de la démo.

## Build / flash

Dans CLion (PlatformIO) ou en ligne de commande :

```bash
pio run              # compilation
pio run -t upload    # flash de la carte
pio device monitor   # journal série (115200)
```

## Périmètre (WOR-66)

Le module ne parle qu'au back-office du groupe, sur le PA `RESILIENCE-G<n>`
(192.168.137.0/24). Reconnexion WiFi automatique. `DEVICE_TOKEN` (optionnel) restreint la
lecture du canal.

## Vérifié

Le canal `GET /v1/device/led` est validé de bout en bout (WOR-100) : `signal` + `seq` suivent
`recognized → granted → rejected → denied`. Le firmware ci-présent doit être **flashé sur la
carte** pour la validation matérielle (pas de carte en CI).
