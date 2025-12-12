# Unraid Troubleshooting Guide für Buchhaltungsanwendung

Dieser Guide hilft Ihnen bei der Diagnose und Behebung häufiger Probleme mit der Buchhaltungsanwendung auf Unraid.

## Diagnose-Tools

### Grundlegende Befehle

```bash
# Container-Status prüfen
docker ps -a | grep buchhaltung

# Alle Container-Logs anzeigen
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml logs

# Einzelne Container-Logs
docker logs buchhaltung-frontend
docker logs buchhaltung-backend
docker logs buchhaltung-db

# Live-Logs verfolgen
docker logs -f buchhaltung-backend

# Netzwerk-Status
docker network inspect buchhaltung-network

# Container neu starten
docker restart buchhaltung-frontend
docker restart buchhaltung-backend
docker restart buchhaltung-db

# Gesamte Stack neu starten
cd /mnt/user/appdata/buchhaltung
docker-compose -f unraid-docker-compose.yml restart
```

## Häufige Probleme und Lösungen

### Problem 1: Container startet nicht

#### Symptome
- Container erscheint nicht in `docker ps`
- Container startet und stoppt sofort wieder
- Status zeigt "Exited (1)" oder ähnlich

#### Diagnose

```bash
# Container-Status prüfen
docker ps -a | grep buchhaltung

# Logs des betroffenen Containers prüfen
docker logs buchhaltung-frontend
docker logs buchhaltung-backend
docker logs buchhaltung-db

# Detaillierte Container-Informationen
docker inspect buchhaltung-backend
```

#### Lösungen

**A) Port bereits in Verwendung:**

```bash
# Prüfen welcher Prozess den Port verwendet
netstat -tulpn | grep 8082
netstat -tulpn | grep 8079
netstat -tulpn | grep 5432

# Bei Konflikt: Port in unraid-docker-compose.yml ändern oder anderen Dienst stoppen
```

**B) Volume-Pfad existiert nicht:**

```bash
# Verzeichnisse erstellen
mkdir -p /mnt/user/appdata/buchhaltung/{frontend/public,backend/uploads,db/data}

# Berechtigungen setzen
chmod -R 777 /mnt/user/appdata/buchhaltung/backend/uploads
chmod -R 777 /mnt/user/appdata/buchhaltung/db/data
chown -R 99:100 /mnt/user/appdata/buchhaltung/
```

**C) Fehlerhafte Konfigurationsdatei:**

```bash
# nginx.conf validieren
docker run --rm -v /mnt/user/appdata/buchhaltung/frontend/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t

# .env Datei prüfen
cat /mnt/user/appdata/buchhaltung/.env

# Compose-Datei validieren
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml config
```

**D) Image konnte nicht heruntergeladen werden:**

```bash
# Manuell Image pullen
docker pull nginx:alpine
docker pull node:18-alpine
docker pull postgres:15-alpine

# Bei Netzwerkproblemen: DNS prüfen
cat /etc/resolv.conf
ping google.com
```

**E) Container nach Abhängigkeit startet nicht:**

```bash
# Einzeln in richtiger Reihenfolge starten
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml up -d buchhaltung-db
sleep 30  # Warten bis DB bereit ist
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml up -d buchhaltung-backend
sleep 10
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml up -d buchhaltung-frontend
```

### Problem 2: Keine Verbindung zur Datenbank

#### Symptome
- Backend zeigt "Cannot connect to database" Fehler
- Anmeldung funktioniert nicht
- "ECONNREFUSED" oder "Connection refused" in Logs

#### Diagnose

```bash
# DB-Container läuft?
docker ps | grep buchhaltung-db

# DB ist bereit?
docker exec buchhaltung-db pg_isready -U buchhaltung_user -d buchhaltung

# Netzwerk-Konnektivität prüfen
docker exec buchhaltung-backend ping -c 3 buchhaltung-db

# Datenbank-Logs prüfen
docker logs buchhaltung-db | tail -50

# Backend-Verbindungsfehler
docker logs buchhaltung-backend | grep -i "database\|connection\|postgres"
```

#### Lösungen

**A) Falsche Datenbank-Credentials:**

```bash
# .env Datei prüfen
grep DB_ /mnt/user/appdata/buchhaltung/.env

# Sollte übereinstimmen mit:
# DB_HOST=buchhaltung-db
# DB_PORT=5432
# DB_NAME=buchhaltung
# DB_USER=buchhaltung_user
# DB_PASSWORD=<Ihr Passwort>

# Backend neu starten nach Änderung
docker restart buchhaltung-backend
```

**B) Datenbank nicht initialisiert:**

```bash
# In Datenbank einloggen und prüfen
docker exec -it buchhaltung-db psql -U buchhaltung_user -d buchhaltung

# SQL-Befehle in psql:
\dt  -- Tabellen anzeigen
\q   -- Beenden

# Falls leer: init.sql manuell ausführen
docker exec -i buchhaltung-db psql -U buchhaltung_user -d buchhaltung < /mnt/user/appdata/buchhaltung/db/init/init.sql
```

**C) Netzwerk-Probleme:**

```bash
# Netzwerk neu erstellen
cd /mnt/user/appdata/buchhaltung
docker-compose -f unraid-docker-compose.yml down
docker network rm buchhaltung-network
docker-compose -f unraid-docker-compose.yml up -d
```

**D) Datenbank beschädigt:**

```bash
# Datenbank-Integrität prüfen
docker exec buchhaltung-db vacuumdb -U buchhaltung_user -d buchhaltung --analyze

# Bei schweren Problemen: Aus Backup wiederherstellen (siehe UNRAID-BACKUP.md)
```

### Problem 3: Frontend lädt nicht / 502 Bad Gateway

#### Symptome
- Browser zeigt leere Seite oder Fehler
- "502 Bad Gateway" oder "504 Gateway Timeout"
- CSS/JS-Dateien werden nicht geladen

#### Diagnose

```bash
# Frontend-Container Status
docker ps | grep buchhaltung-frontend

# nginx-Logs prüfen
docker logs buchhaltung-frontend

# nginx-Konfiguration testen
docker exec buchhaltung-frontend nginx -t

# Port-Binding prüfen
netstat -tulpn | grep 8082
docker port buchhaltung-frontend

# Dateien im Container vorhanden?
docker exec buchhaltung-frontend ls -la /usr/share/nginx/html/
docker exec buchhaltung-frontend cat /etc/nginx/nginx.conf
```

#### Lösungen

**A) nginx-Konfiguration fehlerhaft:**

```bash
# Konfiguration validieren
docker exec buchhaltung-frontend nginx -t

# Bei Fehlern: nginx.conf korrigieren und Container neu starten
nano /mnt/user/appdata/buchhaltung/frontend/nginx.conf
docker restart buchhaltung-frontend
```

**B) Frontend-Dateien fehlen:**

```bash
# Prüfen ob Dateien vorhanden sind
ls -la /mnt/user/appdata/buchhaltung/frontend/public/

# Minimal HTML-Datei erstellen zum Testen
echo '<html><body><h1>Test</h1></body></html>' > /mnt/user/appdata/buchhaltung/frontend/public/index.html

# Container neu starten
docker restart buchhaltung-frontend
```

**C) Backend nicht erreichbar (Proxy-Problem):**

```bash
# Backend-Erreichbarkeit vom Frontend-Container testen
docker exec buchhaltung-frontend wget -O- http://buchhaltung-backend:8079/health

# Backend-Logs prüfen
docker logs buchhaltung-backend

# Sicherstellen dass Backend läuft
docker ps | grep buchhaltung-backend
```

**D) Browser-Cache:**

```bash
# Browser-Cache leeren (Strg+F5)
# Oder Inkognito-Modus verwenden
# Oder anderen Browser testen
```

**E) Berechtigungsprobleme:**

```bash
# Berechtigungen für Frontend-Dateien setzen
chown -R 99:100 /mnt/user/appdata/buchhaltung/frontend/
chmod -R 755 /mnt/user/appdata/buchhaltung/frontend/

# Container neu starten
docker restart buchhaltung-frontend
```

### Problem 4: File-Upload funktioniert nicht

#### Symptome
- "Upload failed" Fehlermeldung
- Dateien werden nicht gespeichert
- "Permission denied" oder "EACCES" Fehler

#### Diagnose

```bash
# Upload-Verzeichnis Berechtigungen prüfen
ls -la /mnt/user/appdata/buchhaltung/backend/uploads/

# Backend-Logs nach Upload-Fehlern durchsuchen
docker logs buchhaltung-backend | grep -i "upload\|eacces\|permission"

# Verfügbarer Speicherplatz
df -h /mnt/user/appdata/

# Im Container prüfen
docker exec buchhaltung-backend ls -la /app/uploads/
docker exec buchhaltung-backend touch /app/uploads/test.txt
```

#### Lösungen

**A) Fehlende Schreibrechte:**

```bash
# Volle Berechtigungen setzen
chmod -R 777 /mnt/user/appdata/buchhaltung/backend/uploads/
chown -R 99:100 /mnt/user/appdata/buchhaltung/backend/uploads/

# Backend neu starten
docker restart buchhaltung-backend
```

**B) Upload-Verzeichnis nicht gemountet:**

```bash
# Volume-Mapping in compose-Datei prüfen
grep -A 5 "buchhaltung-backend:" /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml

# Sollte enthalten:
# - /mnt/user/appdata/buchhaltung/backend/uploads:/app/uploads

# Nach Änderung Container neu erstellen
cd /mnt/user/appdata/buchhaltung
docker-compose -f unraid-docker-compose.yml up -d --force-recreate buchhaltung-backend
```

**C) Dateigrößen-Limit überschritten:**

```bash
# MAX_FILE_SIZE in .env prüfen
grep MAX_FILE_SIZE /mnt/user/appdata/buchhaltung/.env

# Erhöhen falls nötig (in Bytes, z.B. 10485760 = 10MB)
# MAX_FILE_SIZE=52428800  # 50MB

# Backend neu starten
docker restart buchhaltung-backend
```

**D) Speicherplatz voll:**

```bash
# Speicherplatz prüfen
df -h /mnt/user/

# Alte/große Uploads aufräumen wenn nötig
du -sh /mnt/user/appdata/buchhaltung/backend/uploads/*
```

### Problem 5: Session-Verlust / Ständige Abmeldung

#### Symptome
- Benutzer werden nach kurzer Zeit abgemeldet
- "Session expired" Meldungen
- Nach Container-Neustart alle Sessions weg

#### Diagnose

```bash
# SESSION_SECRET gesetzt?
grep SESSION_SECRET /mnt/user/appdata/buchhaltung/.env

# Backend-Logs nach Session-Problemen durchsuchen
docker logs buchhaltung-backend | grep -i "session"

# Container-Neustarts prüfen
docker ps -a --filter "name=buchhaltung-backend" --format "{{.Status}}"
```

#### Lösungen

**A) SESSION_SECRET fehlt:**

```bash
# SESSION_SECRET generieren
SESSION_SECRET=$(openssl rand -hex 32)
echo "SESSION_SECRET=$SESSION_SECRET"

# Zur .env hinzufügen
echo "SESSION_SECRET=$SESSION_SECRET" >> /mnt/user/appdata/buchhaltung/.env

# Backend neu starten
docker restart buchhaltung-backend
```

**B) Sessions nicht persistent (In-Memory):**

Nach Container-Neustart gehen In-Memory-Sessions verloren. Das ist normal.

**Lösung:** Redis für persistente Sessions einrichten (Optional)

```yaml
# In unraid-docker-compose.yml hinzufügen:
  buchhaltung-redis:
    image: redis:7-alpine
    container_name: buchhaltung-redis
    restart: unless-stopped
    networks:
      - buchhaltung-network
    volumes:
      - /mnt/user/appdata/buchhaltung/redis:/data
    command: redis-server --appendonly yes

# Backend .env anpassen:
# REDIS_HOST=buchhaltung-redis
# REDIS_PORT=6379
```

**C) Cookie-Einstellungen:**

```bash
# Prüfen Sie Backend-Code für Cookie-Konfiguration
# Secure Cookies nur bei HTTPS
# SameSite-Attribut richtig gesetzt
```

### Problem 6: Langsame Performance

#### Symptome
- Seiten laden langsam
- Datenbank-Abfragen dauern lange
- Hohe CPU/RAM-Nutzung

#### Diagnose

```bash
# Container-Ressourcennutzung
docker stats buchhaltung-frontend buchhaltung-backend buchhaltung-db

# System-Ressourcen
top
free -h
df -h

# Datenbank-Performance
docker exec buchhaltung-db psql -U buchhaltung_user -d buchhaltung -c "SELECT * FROM pg_stat_activity;"

# Langsame Queries identifizieren
docker exec buchhaltung-db psql -U buchhaltung_user -d buchhaltung -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

#### Lösungen

**A) Datenbank-Optimierung:**

```bash
# VACUUM und ANALYZE durchführen
docker exec buchhaltung-db vacuumdb -U buchhaltung_user -d buchhaltung --analyze

# Indexes prüfen (in psql)
docker exec -it buchhaltung-db psql -U buchhaltung_user -d buchhaltung
\di  -- Indexes anzeigen

# Fehlende Indexes hinzufügen wenn nötig
```

**B) NODE_ENV auf Production setzen:**

```bash
# Prüfen
docker exec buchhaltung-backend printenv | grep NODE_ENV

# In .env setzen
echo "NODE_ENV=production" >> /mnt/user/appdata/buchhaltung/.env

# Backend neu starten
docker restart buchhaltung-backend
```

**C) Log-Level reduzieren:**

```bash
# Im Backend-Code oder .env
# LOG_LEVEL=error  # statt debug oder info
```

**D) Ressourcen-Limits anpassen:**

```yaml
# In unraid-docker-compose.yml für jeden Service:
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      memory: 512M
```

### Problem 7: Update schlägt fehl

#### Symptome
- "Image not found" Fehler
- Container startet nach Update nicht
- Datenbank-Migrationen fehlgeschlagen

#### Diagnose

```bash
# Aktuell verwendete Images
docker images | grep buchhaltung

# Container-Status
docker ps -a | grep buchhaltung

# Update-Logs
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml logs
```

#### Lösungen

**A) Images manuell pullen:**

```bash
docker pull nginx:alpine
docker pull node:18-alpine
docker pull postgres:15-alpine
```

**B) Alte Container entfernen und neu erstellen:**

```bash
cd /mnt/user/appdata/buchhaltung

# Backup erstellen!
./backup-db.sh

# Container stoppen und entfernen
docker-compose -f unraid-docker-compose.yml down

# Neu erstellen
docker-compose -f unraid-docker-compose.yml up -d
```

**C) Alte Images aufräumen:**

```bash
# Ungenutzte Images entfernen
docker image prune -a

# Bei Speicherproblemen: System-Prune
docker system prune -a --volumes
# WARNUNG: Löscht alle ungenutzten Docker-Daten!
```

### Problem 8: Netzwerk-Fehler

#### Symptome
- Container können sich nicht erreichen
- "Network not found" Fehler
- DNS-Auflösung funktioniert nicht

#### Diagnose

```bash
# Netzwerk existiert?
docker network ls | grep buchhaltung

# Netzwerk-Details
docker network inspect buchhaltung-network

# Container im Netzwerk?
docker network inspect buchhaltung-network | grep -A 3 Containers
```

#### Lösungen

**A) Netzwerk neu erstellen:**

```bash
cd /mnt/user/appdata/buchhaltung
docker-compose -f unraid-docker-compose.yml down
docker network rm buchhaltung-network
docker-compose -f unraid-docker-compose.yml up -d
```

**B) DNS-Probleme:**

```bash
# Docker DNS prüfen
docker exec buchhaltung-backend cat /etc/resolv.conf

# DNS-Server in Docker-Daemon konfigurieren
# /etc/docker/daemon.json:
{
  "dns": ["8.8.8.8", "8.8.4.4"]
}

# Docker neu starten
/etc/rc.d/rc.docker restart
```

## Performance-Optimierung

### Unraid-spezifische Optimierungen

#### 1. Appdata auf Cache-Drive (SSD)

```bash
# Prüfen wo Appdata liegt
df -h /mnt/user/appdata/

# Falls nicht auf Cache: In Unraid UI verschieben
# Settings → Shares → appdata → Primary storage: Cache
# Dann: Mover ausführen
```

#### 2. Docker-Image-Pfad auf Cache

```bash
# In Unraid WebGUI:
# Settings → Docker → Docker data location
# Sollte auf /mnt/cache/ sein, nicht /mnt/user/
```

#### 3. Array-Spin-Down beachten

```bash
# Sicherstellen dass Appdata NICHT auf Array liegt
# Sonst: Zugriffe wecken ständig die HDDs auf
```

### Datenbank-Optimierung

```sql
-- In psql als buchhaltung_user
docker exec -it buchhaltung-db psql -U buchhaltung_user -d buchhaltung

-- Shared buffers erhöhen (für größere Datenmengen)
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Container neu starten für Änderungen
-- \q
```

Oder in docker-compose.yml:

```yaml
buchhaltung-db:
  command: 
    - "postgres"
    - "-c"
    - "shared_buffers=256MB"
    - "-c"
    - "effective_cache_size=1GB"
```

### Backend-Optimierung

```env
# In .env
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=2048  # 2GB RAM für Node
LOG_LEVEL=error
```

### Frontend-Optimierung (nginx)

```nginx
# In nginx.conf
http {
    # Gzip-Kompression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Monitoring & Logging

### Container-Health überwachen

```bash
# Health-Status aller Container
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Nur ungesunde Container
docker ps --filter "health=unhealthy"
```

### Log-Rotation prüfen

```bash
# Log-Größen prüfen
du -sh /var/lib/docker/containers/*/

# Log-Rotation ist in compose.yml konfiguriert:
# max-size: "10m"
# max-file: "3"
```

### Automatisches Monitoring-Script

```bash
#!/bin/bash
# /mnt/user/appdata/buchhaltung/monitor.sh

echo "=== Buchhaltung Health Check ==="
echo

echo "Container Status:"
docker ps --filter "name=buchhaltung" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo

echo "Database Connection:"
docker exec buchhaltung-db pg_isready -U buchhaltung_user -d buchhaltung
echo

echo "Frontend Response:"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8082
echo

echo "Backend Response:"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8079/health
echo

echo "Disk Usage:"
df -h /mnt/user/appdata/buchhaltung/
echo

echo "Latest Backup:"
ls -lht /mnt/user/backups/buchhaltung/ | head -5
```

## Weitere Hilfe

Wenn Sie das Problem nicht lösen können:

1. **Logs sammeln:**
   ```bash
   docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml logs > /tmp/buchhaltung-logs.txt
   ```

2. **System-Informationen:**
   ```bash
   uname -a > /tmp/system-info.txt
   docker --version >> /tmp/system-info.txt
   docker-compose --version >> /tmp/system-info.txt
   ```

3. **Konfiguration anonymisieren und teilen:**
   ```bash
   # Passwörter entfernen!
   cat /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml
   cat /mnt/user/appdata/buchhaltung/.env | sed 's/PASSWORD=.*/PASSWORD=***REDACTED***/g'
   ```

4. **Unraid Forum:** https://forums.unraid.net/
5. **Docker Documentation:** https://docs.docker.com/
6. **PostgreSQL Documentation:** https://www.postgresql.org/docs/

## Checkliste bei Problemen

- [ ] Container-Status geprüft (`docker ps -a`)
- [ ] Logs analysiert (`docker logs <container>`)
- [ ] Berechtigungen korrekt (99:100, 777 für uploads/db)
- [ ] .env Datei korrekt konfiguriert
- [ ] Ports nicht von anderem Dienst belegt
- [ ] Netzwerk-Konnektivität geprüft
- [ ] Ausreichend Speicherplatz verfügbar
- [ ] Docker/Unraid auf aktuellem Stand
- [ ] Backup vorhanden vor größeren Änderungen
- [ ] Health-Checks funktionieren
