# Checklist démo — MFA faciale + LED ESP8266 (consigne additionnelle 1)

Pas-à-pas pour monter la démo en local sur le **PC Hôte** et l'**ESP8266**, sans assistance.
Toutes les commandes se lancent depuis la racine du dépôt, sauf indication.

> ⚠️ Le PC Hôte et l'ESP8266 doivent être sur **le même WiFi** (le PA du groupe, ex.
> `RESILIENCE-G6`, ou un hotspot comme `HONOR400`). Repérez l'IP du PC Hôte sur ce réseau :
> ```bash
> hostname -I          # ou : ip -brief addr show wlp115s0
> ```
> Notez-la : c'est `<HOST_IP>` dans la suite (ex. `172.25.117.190`).

## 1. Déployer la plateforme, WAF publié sur le réseau du groupe

Par défaut le WAF n'écoute que sur `127.0.0.1`. Pour que l'ESP l'atteigne, publiez-le sur
`<HOST_IP>` :

```bash
# Détecte automatiquement l'IP du PC Hôte (NE PAS écrire <HOST_IP> en dur dans .env !)
HOST_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}')
grep -q '^WAF_BIND=' infra/.env \
  && sed -i "s/^WAF_BIND=.*/WAF_BIND=$HOST_IP/" infra/.env \
  || echo "WAF_BIND=$HOST_IP" >> infra/.env
grep '^WAF_BIND' infra/.env                                   # doit afficher une IP, pas <HOST_IP>
cd ansible && ansible-playbook playbooks/deploy.yml && cd ..  # idempotent, réensemence la blocklist WAF
```

Vérifier : `curl -s http://<HOST_IP>:8080/v1/device/led` → `{"data":{"signal":"idle","seq":0}}`.

> Toujours passer par `deploy.yml` (il crée `blocked-ips.txt` du WAF) — un `docker compose up`
> seul laisse le WAF en échec.

## 2. Créer un admin et enrôler un visage

```bash
HOST=http://<HOST_IP>:8080
# compte admin (email dans ADMIN_EMAILS du compose : admin@resilience-alpha.local)
curl -s -X POST $HOST/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@resilience-alpha.local","password":"PayGo!123"}'
TOKEN=$(curl -s -X POST $HOST/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@resilience-alpha.local","password":"PayGo!123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
# enrôler le visage (photo nette de l'opérateur, en base64)
printf '{"email":"admin@resilience-alpha.local","imageBase64":"%s"}' "$(base64 -w0 visage.jpg)" \
  | curl -s -X POST $HOST/v1/admin/faces/enroll -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' -d @-
curl -s $HOST/v1/admin/faces -H "Authorization: Bearer $TOKEN"   # doit lister le compte
```

Enrôler **2–3 photos** du même visage améliore la robustesse.

## 3. Flasher l'ESP8266

Câblage LED bicolore (cathode commune) : **vert → D1 (GPIO5)**, **rouge → D2 (GPIO4)**,
cathode → **GND** via une résistance ~330 Ω par anode.

```bash
cd iot/led-indicator
cp include/config.example.h include/config.h
# éditer include/config.h :
#   WIFI_SSID     "<SSID du PA>"
#   WIFI_PASSWORD "<mot de passe>"
#   LED_ENDPOINT  "http://<HOST_IP>:8080/v1/device/led"
~/.local/bin/pio run -t upload        # compile + flash (carte sur /dev/ttyUSB0)
```

Si `/dev/ttyUSB0` est absent alors que la carte est branchée (puce CH340) : voir *Dépannage*.

Contrôler le démarrage (lecture série directe, le moniteur PlatformIO exige un terminal) :

```bash
python3 - <<'PY'
import serial, time
s = serial.Serial('/dev/ttyUSB0', 115200, timeout=0.3)
s.dtr=False; s.rts=True; time.sleep(0.15); s.rts=False     # reset
end=time.time()+15
while time.time()<end:
    l=s.readline().decode('utf-8','replace').rstrip()
    if l.strip(): print(l)
PY
# attendu : [led-indicator] boot ... / [wifi] OK, IP ...
```

## 4. Dérouler la démo

Lancer l'interface (front Vite pointant sur le WAF, origine CORS déjà autorisée) :

```bash
scripts/demo-start.sh        # ou : scripts/demo-start.sh <HOST_IP>
```

1. Ouvrir **http://localhost:5173** dans un navigateur **sur le PC Hôte** (la caméra USB y est
   branchée). ⚠️ Bien ouvrir `localhost` : `getUserMedia` est bloqué sur une IP en http.
2. Saisir l'**identifiant** (`admin@resilience-alpha.local`) → la **caméra s'active**.
3. Regarder la caméra, **Confirmer mon identité** :
   - visage **reconnu** → **LED vert clignotant**, le champ **mot de passe** apparaît ;
   - visage **non reconnu** → **LED rouge fixe 30 s**, identifiant remis à vide (1 réessai puis
     blocage 5 min).
4. Saisir le mot de passe :
   - **correct** → **LED vert fixe 30 s**, accès au back-office ;
   - **erroné** → **LED rouge clignote 10×**, retour à l'identification.

### Sans navigateur (vérification rapide en ligne de commande)

```bash
# face-check (reconnu) puis login : la LED doit passer vert clignotant puis vert fixe
FT=$(printf '{"email":"admin@resilience-alpha.local","imageBase64":"%s"}' "$(base64 -w0 visage.jpg)" \
  | curl -s -X POST $HOST/v1/auth/face-check -H 'Content-Type: application/json' -d @- \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['faceToken'])")
curl -s -X POST $HOST/v1/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@resilience-alpha.local\",\"password\":\"PayGo!123\",\"faceToken\":\"$FT\"}"
curl -s $HOST/v1/device/led       # signal=granted (la LED suit)
```

## 5. Dépannage

| Symptôme | Cause / solution |
|---|---|
| `curl http://<HOST_IP>:8080/...` ne répond pas | `WAF_BIND` pas sur `<HOST_IP>` → étape 1 ; vérifier le pare-feu du PC Hôte |
| Pas de `/dev/ttyUSB0` (carte branchée) | `brltty` capte la puce CH340 : `sudo apt remove brltty` puis rebrancher |
| Flash « Failed to connect » | maintenir **FLASH**, appuyer **RST**, relâcher RST puis FLASH ; vérifier le câble (data, pas charge) |
| `[wifi] echec` en série | SSID/mot de passe de `config.h` ; le hotspot doit être en **2,4 GHz** (l'ESP8266 ne fait pas 5 GHz) |
| LED ne bouge pas mais série OK | `LED_ENDPOINT` = IP du PC Hôte joignable depuis l'ESP ; LED câblée sur D1/D2 ; tester `curl $HOST/v1/device/led` |
| Visage toujours « non reconnu » | ré-enrôler avec une photo nette, de face, bien éclairée ; baisser `FACE_THRESHOLD` (défaut 0.40) sur le service |
| Enrôlement → 400 au WAF | corps base64 > limite : `MODSEC_REQ_BODY_NOFILES_LIMIT` du WAF (déjà à 8 Mo) |

## 6. Remise à zéro entre deux essais

```bash
scripts/export-logs.sh --since 15m   # (optionnel) conserver les preuves AVANT reset
scripts/reset-known-good.sh          # réarme la plateforme (efface les logs Loki)
```
