# Unraid Update-Anleitung für Buchhaltungsanwendung

Diese Anleitung beschreibt verschiedene Update-Verfahren für Ihre Buchhaltungsanwendung auf Unraid.

## Inhaltsverzeichnis

1. [Container-Images aktualisieren](#container-images-aktualisieren)
2. [Anwendungscode aktualisieren](#anwendungscode-aktualisieren)
3. [Datenbank-Migrationen](#datenbank-migrationen)
4. [Sicherheitshinweise](#sicherheitshinweise)
5. [Automatische Updates](#automatische-updates)
6. [Rollback-Verfahren](#rollback-verfahren)

## Vorbereitung

### Vor jedem Update

**WICHTIG:** Erstellen Sie immer ein Backup vor Updates!

```bash
# Backup erstellen
/mnt/user/appdata/buchhaltung/backup-db.sh

# Oder manuell:
cd /mnt/user/appdata/buchhaltung
docker exec buchhaltung-db pg_dump -U buchhaltung_user -d buchhaltung -F c -f /tmp/backup_before_update.dump
docker cp buchhaltung-db:/tmp/backup_before_update.dump /mnt/user/backups/buchhaltung/
```

### Update-Checkliste

- [ ] Backup erstellt und verifiziert
- [ ] Release Notes gelesen (falls verfügbar)
- [ ] Wartungsfenster geplant (minimale Downtime)
- [ ] Benutzer informiert (falls mehrere Nutzer)
- [ ] Ausreichend Speicherplatz verfügbar
- [ ] Zugriff auf Unraid-Terminal/SSH

## Container-Images aktualisieren

### Methode 1: Einzelne Container (Docker-native)

#### Schritt 1: Neue Images herunterladen

```bash
# Alle Images aktualisieren
docker pull nginx:alpine
docker pull node:18-alpine
docker pull postgres:15-alpine
```

#### Schritt 2: Container neu erstellen

```bash
cd /mnt/user/appdata/buchhaltung

# Methode A: Mit docker-compose (empfohlen)
docker-compose -f unraid-docker-compose.yml pull
docker-compose -f unraid-docker-compose.yml up -d --force-recreate

# Methode B: Einzeln
docker stop buchhaltung-frontend
docker rm buchhaltung-frontend
docker-compose -f unraid-docker-compose.yml up -d buchhaltung-frontend
```

#### Schritt 3: Alte Images entfernen

```bash
# Ungenutzte Images aufräumen
docker image prune -a

# Bestätigen mit 'y'
```

### Methode 2: Mit Docker Compose Manager Plugin

Wenn Sie das Docker Compose Manager Plugin verwenden:

1. Öffnen Sie Unraid WebGUI
2. Navigieren Sie zu **Docker Compose Manager**
3. Wählen Sie den Stack "buchhaltung"
4. Klicken Sie auf **Compose Pull** (lädt neue Images)
5. Klicken Sie auf **Compose Up** (erstellt Container neu)

### Methode 3: Watchtower (Automatisch)

Watchtower überwacht Container und aktualisiert sie automatisch.

#### Watchtower installieren

```bash
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --cleanup \
  --include-stopped \
  --schedule "0 0 4 * * *"  # Täglich um 4:00 Uhr
```

#### Watchtower für spezifische Container

```yaml
# In unraid-docker-compose.yml Labels hinzufügen:
services:
  buchhaltung-frontend:
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
  
  buchhaltung-backend:
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
  
  buchhaltung-db:
    labels:
      - "com.centurylinklabs.watchtower.enable=false"  # DB nicht automatisch updaten!
```

**WARNUNG:** Automatische Datenbank-Updates können zu Datenverlust führen!

### Schritt-für-Schritt: Komplettes Image-Update

```bash
#!/bin/bash
# Vollständiges Update-Script

cd /mnt/user/appdata/buchhaltung

echo "1. Backup erstellen..."
./backup-db.sh

echo "2. Aktuelle Images anzeigen..."
docker images | grep -E "nginx|node|postgres"

echo "3. Neue Images herunterladen..."
docker-compose -f unraid-docker-compose.yml pull

echo "4. Container neu erstellen..."
docker-compose -f unraid-docker-compose.yml up -d --force-recreate

echo "5. Status prüfen..."
docker ps | grep buchhaltung

echo "6. Alte Images aufräumen..."
docker image prune -a -f

echo "7. Update abgeschlossen!"
docker-compose -f unraid-docker-compose.yml ps
```

## Anwendungscode aktualisieren

Falls Sie den Anwendungscode angepasst haben oder Updates aus einem Git-Repository ziehen.

### Mit Git-Repository

#### Schritt 1: Repository aktualisieren

```bash
cd /mnt/user/appdata/buchhaltung/

# Aktuelle Änderungen sichern
git stash

# Neueste Version abrufen
git fetch origin
git pull origin main

# Falls Änderungen vorhanden waren
git stash pop
```

#### Schritt 2: Dependencies aktualisieren

```bash
# Backend-Dependencies
docker exec buchhaltung-backend npm install

# Oder: Container neu bauen
docker-compose -f unraid-docker-compose.yml build buchhaltung-backend
```

#### Schritt 3: Container neu starten

```bash
docker-compose -f unraid-docker-compose.yml up -d --build
```

### Ohne Git (Manuelle Dateien)

#### Schritt 1: Backup der aktuellen Dateien

```bash
# Backup erstellen
tar -czf /tmp/buchhaltung-code-backup-$(date +%Y%m%d).tar.gz \
    /mnt/user/appdata/buchhaltung/frontend/public/ \
    /mnt/user/appdata/buchhaltung/backend/app/
```

#### Schritt 2: Neue Dateien hochladen

```bash
# Per SCP oder direkt auf Unraid kopieren
# Beispiel mit SCP:
# scp -r ./frontend/public/* root@<UNRAID-IP>:/mnt/user/appdata/buchhaltung/frontend/public/
```

#### Schritt 3: Berechtigungen setzen

```bash
chown -R 99:100 /mnt/user/appdata/buchhaltung/frontend/public/
chown -R 99:100 /mnt/user/appdata/buchhaltung/backend/app/
```

#### Schritt 4: Container neu starten

```bash
docker-compose -f unraid-docker-compose.yml restart
```

## Datenbank-Migrationen

### Automatische Migrationen (falls unterstützt)

Wenn Ihre Anwendung Migrations-Tools verwendet (z.B. Sequelize, TypeORM, Knex):

```bash
# Container temporär mit Migrations-Befehl starten
docker exec buchhaltung-backend npm run migrate

# Oder als separater Container
docker-compose -f unraid-docker-compose.yml run --rm buchhaltung-backend npm run migrate
```

### Manuelle SQL-Migrationen

#### Schritt 1: Migrations-SQL vorbereiten

Erstellen Sie eine Datei: `/mnt/user/appdata/buchhaltung/migrations/001_add_column.sql`

```sql
-- Migration: Spalte hinzufügen
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index erstellen
CREATE INDEX IF NOT EXISTS idx_transactions_notes ON transactions(notes);

-- Daten aktualisieren (optional)
UPDATE transactions SET notes = '' WHERE notes IS NULL;
```

#### Schritt 2: Migration ausführen

```bash
# Backup erstellen!
/mnt/user/appdata/buchhaltung/backup-db.sh

# Migration anwenden
docker exec -i buchhaltung-db psql -U buchhaltung_user -d buchhaltung < /mnt/user/appdata/buchhaltung/migrations/001_add_column.sql

# Prüfen ob erfolgreich
docker exec buchhaltung-db psql -U buchhaltung_user -d buchhaltung -c "\d transactions"
```

#### Schritt 3: Migration rückgängig machen (Rollback)

Erstellen Sie: `/mnt/user/appdata/buchhaltung/migrations/001_add_column_rollback.sql`

```sql
-- Rollback: Spalte entfernen
ALTER TABLE transactions DROP COLUMN IF EXISTS notes;
DROP INDEX IF EXISTS idx_transactions_notes;
```

```bash
# Bei Problemen: Rollback
docker exec -i buchhaltung-db psql -U buchhaltung_user -d buchhaltung < /mnt/user/appdata/buchhaltung/migrations/001_add_column_rollback.sql
```

### Datenbank-Version prüfen

```bash
# PostgreSQL-Version
docker exec buchhaltung-db psql -U buchhaltung_user -d buchhaltung -c "SELECT version();"

# Schema-Version (falls tracking implementiert)
docker exec buchhaltung-db psql -U buchhaltung_user -d buchhaltung -c "SELECT * FROM schema_migrations;"
```

## Konfiguration aktualisieren

### .env Datei aktualisieren

```bash
# Backup der alten .env
cp /mnt/user/appdata/buchhaltung/.env /mnt/user/appdata/buchhaltung/.env.backup-$(date +%Y%m%d)

# .env bearbeiten
nano /mnt/user/appdata/buchhaltung/.env

# Nach Änderungen: Betroffene Container neu starten
docker restart buchhaltung-backend
```

### Compose-Datei aktualisieren

```bash
# Backup der alten Compose-Datei
cp /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml \
   /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml.backup-$(date +%Y%m%d)

# Compose-Datei bearbeiten
nano /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml

# Validieren
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml config

# Container mit neuer Konfiguration neu erstellen
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml up -d --force-recreate
```

## Sicherheitshinweise

### Security-Updates priorisieren

Kritische Sicherheitsupdates sollten schnellstmöglich eingespielt werden.

```bash
# Sicherheitsinformationen für Images prüfen (mit Trivy)
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image nginx:alpine

# Für alle Images
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image node:18-alpine

docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image postgres:15-alpine
```

### CVE-Monitoring

Überwachen Sie bekannte Schwachstellen:

- https://hub.docker.com/_/nginx (Security Tab)
- https://hub.docker.com/_/node (Security Tab)
- https://hub.docker.com/_/postgres (Security Tab)

## Automatische Updates

### User Scripts für regelmäßige Updates

Erstellen Sie ein User Script für wöchentliche Updates:

```bash
#!/bin/bash
# Name: Buchhaltung Weekly Update
# Schedule: Weekly (z.B. Sonntag 2:00 Uhr)

cd /mnt/user/appdata/buchhaltung

# Backup erstellen
echo "Creating backup..."
./backup-db.sh

# Images aktualisieren
echo "Pulling new images..."
docker-compose -f unraid-docker-compose.yml pull

# Neue Images verfügbar?
if [ $? -eq 0 ]; then
    echo "Recreating containers..."
    docker-compose -f unraid-docker-compose.yml up -d --force-recreate
    
    # Alte Images aufräumen
    echo "Cleaning up old images..."
    docker image prune -a -f
    
    echo "Update completed successfully"
else
    echo "No updates available or pull failed"
fi

# Status prüfen
docker-compose -f unraid-docker-compose.yml ps
```

### Update-Benachrichtigungen

Mit Diun (Docker Image Update Notifier):

```bash
docker run -d \
  --name diun \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /mnt/user/appdata/diun:/data \
  crazymax/diun:latest \
  --schedule "0 */6 * * *" \
  --watch-schedule "0 */6 * * *"
```

## Rollback-Verfahren

Falls ein Update Probleme verursacht, können Sie zurückrollen.

### Container-Rollback

```bash
# Aktuelle Container stoppen
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml down

# Alte Image-Version manuell pullen
docker pull nginx:1.25-alpine  # Beispiel für ältere Version
docker tag nginx:1.25-alpine nginx:alpine

# Container mit altem Image starten
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml up -d
```

### Datenbank-Rollback

```bash
# Container stoppen
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml down

# Alte Datenbank aus Backup wiederherstellen
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml up -d buchhaltung-db
sleep 15

# Backup einspielen
docker cp /mnt/user/backups/buchhaltung/db_backup_YYYYMMDD_HHMMSS.dump buchhaltung-db:/tmp/restore.dump
docker exec buchhaltung-db pg_restore -U buchhaltung_user -d buchhaltung --clean /tmp/restore.dump

# Alle Container starten
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml up -d
```

### Code-Rollback (mit Git)

```bash
cd /mnt/user/appdata/buchhaltung

# Commit-Historie anzeigen
git log --oneline -10

# Zu spezifischem Commit zurückkehren
git reset --hard <commit-hash>

# Container neu bauen
docker-compose -f unraid-docker-compose.yml up -d --build
```

### Vollständiger Rollback

```bash
# 1. Container stoppen
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml down

# 2. Alte Konfiguration wiederherstellen
cp /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml.backup-YYYYMMDD \
   /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml

cp /mnt/user/appdata/buchhaltung/.env.backup-YYYYMMDD \
   /mnt/user/appdata/buchhaltung/.env

# 3. Datenbank wiederherstellen (siehe oben)

# 4. Container neu starten
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml up -d
```

## Update-Protokoll

Führen Sie ein Protokoll über Updates:

```bash
# Update-Log erstellen
echo "=== Update Log ===" > /mnt/user/appdata/buchhaltung/UPDATE_LOG.md
echo "" >> /mnt/user/appdata/buchhaltung/UPDATE_LOG.md

# Eintrag hinzufügen
cat >> /mnt/user/appdata/buchhaltung/UPDATE_LOG.md << EOF
## Update $(date +%Y-%m-%d)

- **Was:** Container-Images aktualisiert
- **Von:** nginx:1.25, node:18.16, postgres:15.3
- **Zu:** nginx:1.26, node:18.17, postgres:15.4
- **Backup:** /mnt/user/backups/buchhaltung/db_backup_$(date +%Y%m%d).dump
- **Probleme:** Keine
- **Durchgeführt von:** $(whoami)

EOF
```

## Wartungsfenster planen

### Minimale Downtime

```bash
# Schnelles Update mit minimaler Downtime
cd /mnt/user/appdata/buchhaltung

# 1. Images im Voraus herunterladen (keine Downtime)
docker-compose -f unraid-docker-compose.yml pull

# 2. Backup erstellen (minimale Performance-Beeinträchtigung)
./backup-db.sh

# 3. Schneller Neustart (ca. 30 Sekunden Downtime)
docker-compose -f unraid-docker-compose.yml up -d --force-recreate
```

### Wartungsseite anzeigen (Optional)

Temporäre Wartungsseite:

```bash
# Wartungsseite erstellen
cat > /mnt/user/appdata/buchhaltung/frontend/public/maintenance.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Wartung</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>🔧 Wartungsarbeiten</h1>
    <p>Die Buchhaltungsanwendung wird gerade aktualisiert.</p>
    <p>Wir sind in wenigen Minuten wieder für Sie da.</p>
</body>
</html>
EOF

# Während Update: index.html temporär ersetzen
mv /mnt/user/appdata/buchhaltung/frontend/public/index.html \
   /mnt/user/appdata/buchhaltung/frontend/public/index.html.backup

cp /mnt/user/appdata/buchhaltung/frontend/public/maintenance.html \
   /mnt/user/appdata/buchhaltung/frontend/public/index.html

# Nach Update: Wiederherstellen
mv /mnt/user/appdata/buchhaltung/frontend/public/index.html.backup \
   /mnt/user/appdata/buchhaltung/frontend/public/index.html
```

## Post-Update Checkliste

Nach jedem Update prüfen:

- [ ] Alle Container laufen: `docker ps | grep buchhaltung`
- [ ] Health-Checks OK: `docker ps --filter "health=healthy"`
- [ ] Logs zeigen keine Fehler: `docker-compose logs --tail=50`
- [ ] Frontend erreichbar: `http://<UNRAID-IP>:8082`
- [ ] Backend erreichbar: `http://<UNRAID-IP>:8079/health`
- [ ] Datenbank-Verbindung: `docker exec buchhaltung-db pg_isready -U buchhaltung_user`
- [ ] Login funktioniert
- [ ] Upload-Funktionalität funktioniert
- [ ] Daten sind vollständig
- [ ] Performance ist normal

## Version-Tracking

### Verwendete Versionen dokumentieren

```bash
# Aktuelle Versionen ermitteln
docker exec buchhaltung-frontend nginx -v 2>&1
docker exec buchhaltung-backend node --version
docker exec buchhaltung-db psql --version

# In Datei speichern
cat > /mnt/user/appdata/buchhaltung/VERSIONS.txt << EOF
# Buchhaltung Component Versions - Updated: $(date)

Frontend (nginx): $(docker exec buchhaltung-frontend nginx -v 2>&1)
Backend (node):   $(docker exec buchhaltung-backend node --version)
Database (postgres): $(docker exec buchhaltung-db psql --version | head -1)

Docker Images:
$(docker images | grep -E "nginx|node|postgres" | grep -E "alpine")
EOF
```

## Zusammenfassung

**Empfohlene Update-Strategie:**

1. **Wöchentlich:** Container-Image-Updates mit User Script
2. **Monatlich:** Vollständiges Review und manuelle Prüfung
3. **Bei Bedarf:** Code-Updates aus Repository
4. **Sofort:** Kritische Sicherheitsupdates

**Vor jedem Update:**
- Backup erstellen ✓
- Release Notes lesen ✓
- Wartungsfenster planen ✓

**Nach jedem Update:**
- Funktionalität testen ✓
- Logs prüfen ✓
- Update dokumentieren ✓

Bei Fragen oder Problemen: Siehe [UNRAID-TROUBLESHOOTING.md](UNRAID-TROUBLESHOOTING.md)
