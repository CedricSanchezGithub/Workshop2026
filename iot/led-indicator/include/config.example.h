#pragma once
// Copier en config.h et renseigner (config.h est ignoré par Git — aucun secret dans le dépôt).

#define WIFI_SSID      "RESILIENCE-G6"
#define WIFI_PASSWORD  "change-me"

// Canal LED exposé par le back-office, atteint via le WAF (point d'entrée du groupe).
// Le jour de la démo, le WAF est publié sur 192.168.137.1:8080.
#define LED_ENDPOINT   "http://192.168.137.1:8080/v1/device/led"

// Optionnel : doit correspondre à DEVICE_TOKEN du back-office (laisser vide si non défini).
#define DEVICE_TOKEN   ""

// Broches de la LED bicolore (cathode commune). D1=GPIO5 (vert), D2=GPIO4 (rouge).
#define GREEN_PIN      D1
#define RED_PIN        D2
