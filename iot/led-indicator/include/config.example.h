#pragma once
// Copier en config.h et renseigner (config.h est ignoré par Git — aucun secret dans le dépôt).

#define WIFI_SSID      "RESILIENCE-G6"
#define WIFI_PASSWORD  "change-me"

// Canal LED exposé par le back-office, atteint via le WAF (point d'entrée du groupe).
// Le jour de la démo, le WAF est publié sur 192.168.137.1:8080.
#define LED_ENDPOINT   "http://192.168.137.1:8080/v1/device/led"

// Optionnel : doit correspondre à DEVICE_TOKEN du back-office (laisser vide si non défini).
#define DEVICE_TOKEN   ""

// LED bicolore UNIQUE à 3 broches : les deux couleurs sur GREEN_PIN/RED_PIN, la 3e broche commune.
// D1=GPIO5 (vert), D2=GPIO4 (rouge), chaque couleur via une résistance ~330 Ω.
#define GREEN_PIN      D1
#define RED_PIN        D2

// Type de la LED : 0 = cathode commune (broche commune au GND) ; 1 = anode commune (broche commune au 3V3).
#define COMMON_ANODE   0
