// Indicateur LED bicolore ESP8266 (WOR-99) — consigne additionnelle 1.
//
// L'ESP8266 se connecte au WiFi du groupe (RESILIENCE-G<n>), poll le canal
// GET /v1/device/led du back-office (WOR-100) et pilote une LED rouge/vert selon
// l'état du flux d'authentification :
//   idle       -> éteinte
//   recognized -> vert clignotant (en attente du mot de passe)
//   granted    -> vert fixe 30 s puis éteint (mot de passe validé)
//   denied     -> rouge clignote 10 fois puis éteint (mot de passe erroné)
//   rejected   -> rouge fixe 30 s puis éteint (visage non reconnu / verrou)
//
// Les motifs sont NON BLOQUANTS (millis()) pour que le WiFi et le poll restent réactifs ;
// un nouvel évènement (seq différent) interrompt le motif en cours.
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include "config.h"

#ifndef POLL_INTERVAL_MS
#define POLL_INTERVAL_MS 400
#endif

enum LedMode { MODE_OFF, MODE_GREEN_BLINK, MODE_GREEN_SOLID, MODE_RED_BLINK, MODE_RED_SOLID };

static LedMode mode = MODE_OFF;
static unsigned long modeDeadline = 0;  // échéance des motifs fixes (solid)
static int redBlinksLeft = 0;           // clignotements rouges restants
static unsigned long lastToggle = 0;
static bool ledPhase = false;
static long lastSeq = -1;
static unsigned long lastPoll = 0;

static void setLed(bool green, bool red) {
  digitalWrite(GREEN_PIN, green ? HIGH : LOW);
  digitalWrite(RED_PIN, red ? HIGH : LOW);
}

static void applySignal(const String& signal) {
  lastToggle = 0;
  ledPhase = false;
  if (signal == "recognized") {
    mode = MODE_GREEN_BLINK;
  } else if (signal == "granted") {
    mode = MODE_GREEN_SOLID;
    modeDeadline = millis() + 30000UL;
  } else if (signal == "denied") {
    mode = MODE_RED_BLINK;
    redBlinksLeft = 10;
  } else if (signal == "rejected") {
    mode = MODE_RED_SOLID;
    modeDeadline = millis() + 30000UL;
  } else {
    mode = MODE_OFF; // idle ou inconnu
  }
}

static void updateLed() {
  const unsigned long now = millis();
  switch (mode) {
    case MODE_OFF:
      setLed(false, false);
      break;
    case MODE_GREEN_SOLID:
      setLed(true, false);
      if (now >= modeDeadline) mode = MODE_OFF;
      break;
    case MODE_RED_SOLID:
      setLed(false, true);
      if (now >= modeDeadline) mode = MODE_OFF;
      break;
    case MODE_GREEN_BLINK:
      if (now - lastToggle >= 300) { ledPhase = !ledPhase; lastToggle = now; }
      setLed(ledPhase, false);
      break;
    case MODE_RED_BLINK:
      if (now - lastToggle >= 150) {
        ledPhase = !ledPhase;
        lastToggle = now;
        if (!ledPhase && --redBlinksLeft <= 0) { mode = MODE_OFF; setLed(false, false); break; }
      }
      setLed(false, ledPhase);
      break;
  }
}

static void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000UL) {
    delay(200);
    updateLed(); // garde la LED vivante pendant la (re)connexion
  }
}

static void poll() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClient client;
  HTTPClient http;
  String url = LED_ENDPOINT;
  if (strlen(DEVICE_TOKEN) > 0) { url += "?token="; url += DEVICE_TOKEN; }
  if (!http.begin(client, url)) return;
  http.setTimeout(2000);
  const int code = http.GET();
  if (code == 200) {
    JsonDocument doc;
    if (!deserializeJson(doc, http.getString())) {
      const long seq = doc["data"]["seq"] | -1;
      const char* signal = doc["data"]["signal"] | "idle";
      if (seq != lastSeq) {
        lastSeq = seq;
        applySignal(String(signal));
      }
    }
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(RED_PIN, OUTPUT);
  setLed(false, false);
  ensureWifi();
}

void loop() {
  updateLed();
  const unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    ensureWifi();
    poll();
  }
}
