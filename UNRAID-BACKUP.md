# Unraid Backup-Strategie für Buchhaltungsanwendung

Diese Anleitung beschreibt umfassende Backup- und Wiederherstellungsstrategien für Ihre Buchhaltungsanwendung auf Unraid.

## Was muss gesichert werden?

### 1. Datenbank (HÖCHSTE PRIORITÄT)

Die PostgreSQL-Datenbank enthält alle Ihre Finanzdaten, Transaktionen und Benutzerkontoinformationen.

- **Pfad:** `/mnt/user/appdata/buchhaltung/db/data/`
- **Empfehlung:** Täglich automatisch sichern
- **Kritikalität:** HOCH - Datenverlust kann nicht toleriert werden

### 2. Uploads (HOHE PRIORITÄT)

Hochgeladene Dateien wie Rechnungen, Quittungen, Belege und andere Dokumente.

- **Pfad:** `/mnt/user/appdata/buchhaltung/backend/uploads/`
- **Empfehlung:** Täglich automatisch sichern
- **Kritikalität:** HOCH - Wichtige Geschäftsdokumente

### 3. Konfigurationsdateien (MITTLERE PRIORITÄT)

Wichtige Konfigurationsdateien für die Wiederherstellung der Anwendung.

- **Dateien:**
  - `/mnt/user/appdata/buchhaltung/.env`
  - `/mnt/user/appdata/buchhaltung/unraid-docker-compose.yml`
  - `/mnt/user/appdata/buchhaltung/frontend/nginx.conf`
  - `/mnt/user/appdata/buchhaltung/db/init/init.sql`
- **Empfehlung:** Bei Änderungen sichern
- **Kritikalität:** MITTEL - Kann manuell wiederhergestellt werden, aber zeitaufwendig

### 4. Anwendungscode (NIEDRIGE PRIORITÄT)

Frontend- und Backend-Code (falls lokal angepasst).

- **Pfade:**
  - `/mnt/user/appdata/buchhaltung/frontend/public/`
  - `/mnt/user/appdata/buchhaltung/backend/app/`
- **Empfehlung:** Bei Änderungen sichern
- **Kritikalität:** NIEDRIG - Kann aus Repository wiederhergestellt werden

## Backup-Methoden

### Methode A: Unraid CA Backup Plugin (Empfohlen für Anfänger)

Das Community Applications Backup Plugin ist die einfachste Methode für automatische Backups.

#### Installation

1. Öffnen Sie Unraid WebGUI
2. Navigieren Sie zu **Apps** (Community Applications)
3. Suchen Sie nach "CA Appdata Backup / Restore"
4. Installieren Sie das Plugin

#### Konfiguration

1. Navigieren Sie zu **Plugins** → **CA Appdata Backup/Restore**
2. Konfigurieren Sie folgende Einstellungen:

**Backup-Einstellungen:**
```
Backup Folder: /mnt/user/backups/appdata/
Appdata folder to backup: /mnt/user/appdata/buchhaltung/
Backup the entire appdata? No
Schedule: Daily (z.B. 03:00 Uhr)
Delete backups older than: 30 days
```

**Notification:**
```
Enable Notifications: Yes
Notification method: Email/Discord/Telegram (nach Wahl)
Notify on errors only: No (um erfolgreiche Backups zu bestätigen)
```

3. Klicken Sie auf **Apply**
4. Führen Sie einen Test-Backup durch: Klicken Sie auf **Backup Now**

#### Vorteile
- Einfache grafische Oberfläche
- Automatische Zeitplanung
- E-Mail-Benachrichtigungen
- Integriert in Unraid

#### Nachteile
- Sichert gesamte Verzeichnisse (größere Backup-Dateien)
- Keine inkrementellen Backups
- Datenbank sollte zusätzlich mit pg_dump gesichert werden

### Methode B: Manuelles Datenbank-Backup Script

Für professionelle Datenbank-Backups mit pg_dump.

#### Backup-Script erstellen

Erstellen Sie die Datei `/mnt/user/appdata/buchhaltung/backup-db.sh`:

```bash
#!/bin/bash
##############################################
# Buchhaltung Database Backup Script
# Führt ein vollständiges PostgreSQL Backup durch
##############################################

# Konfiguration
BACKUP_DIR="/mnt/user/backups/buchhaltung"
CONTAINER_NAME="buchhaltung-db"
DB_USER="buchhaltung_user"
DB_NAME="buchhaltung"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="db_backup_${DATE}.dump"
LOG_FILE="${BACKUP_DIR}/backup.log"
RETENTION_DAYS=30

# Backup-Verzeichnis erstellen
mkdir -p "$BACKUP_DIR"

# Logging-Funktion
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting database backup..."

# Prüfen ob Container läuft
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    log "ERROR: Container $CONTAINER_NAME is not running!"
    exit 1
fi

# Backup erstellen
log "Creating backup: $BACKUP_FILE"
docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F c \
    -f "/tmp/$BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    log "ERROR: Database backup failed!"
    exit 1
fi

# Backup aus Container kopieren
log "Copying backup from container..."
docker cp "${CONTAINER_NAME}:/tmp/${BACKUP_FILE}" "${BACKUP_DIR}/${BACKUP_FILE}"

if [ $? -ne 0 ]; then
    log "ERROR: Failed to copy backup from container!"
    exit 1
fi

# Temporäre Datei im Container löschen
docker exec "$CONTAINER_NAME" rm "/tmp/$BACKUP_FILE"

# Backup-Größe prüfen
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
log "Backup created successfully: ${BACKUP_FILE} (Size: ${BACKUP_SIZE})"

# Alte Backups löschen
log "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "db_backup_*.dump" -mtime +$RETENTION_DAYS -delete
DELETED_COUNT=$(find "$BACKUP_DIR" -name "db_backup_*.dump" -mtime +$RETENTION_DAYS | wc -l)
log "Deleted $DELETED_COUNT old backup(s)"

# Zusammenfassung
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "db_backup_*.dump" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Backup completed. Total backups: $TOTAL_BACKUPS (Total size: $TOTAL_SIZE)"

exit 0
```

#### Script ausführbar machen

```bash
chmod +x /mnt/user/appdata/buchhaltung/backup-db.sh
```

#### Manuell testen

```bash
/mnt/user/appdata/buchhaltung/backup-db.sh
```

Prüfen Sie das Backup:

```bash
ls -lh /mnt/user/backups/buchhaltung/
cat /mnt/user/backups/buchhaltung/backup.log
```

### Methode C: User Scripts Plugin Integration (Empfohlen für Automatisierung)

Automatisieren Sie das Backup-Script mit dem User Scripts Plugin.

#### Installation

1. Installieren Sie "User Scripts" aus Community Applications
2. Navigieren Sie zu **Settings** → **User Scripts**

#### Script hinzufügen

1. Klicken Sie auf **Add New Script**
2. Name: `Buchhaltung Database Backup`
3. Beschreibung: `Täglich automatisches Datenbank-Backup`
4. Script-Inhalt: Kopieren Sie den Inhalt von `backup-db.sh`

#### Zeitplanung

1. Klicken Sie auf das Zahnrad-Symbol neben dem Script
2. Wählen Sie **Schedule:** `Custom`
3. Cron-Ausdruck: `0 3 * * *` (täglich um 3:00 Uhr)
   - Oder wählen Sie eine vorgefertigte Option wie "Daily"

#### Benachrichtigungen

1. Klicken Sie auf **Notify If** → `If failure`
2. Oder setzen Sie `Always` für alle Backup-Berichte

#### Testen

Klicken Sie auf **Run Script** um das Backup manuell zu testen.

### Methode D: Vollständiges Appdata-Backup

Sichern Sie das komplette Buchhaltungsverzeichnis.

```bash
#!/bin/bash
# /mnt/user/appdata/buchhaltung/backup-full.sh

BACKUP_DIR="/mnt/user/backups/buchhaltung/full"
SOURCE_DIR="/mnt/user/appdata/buchhaltung"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="buchhaltung_full_${DATE}.tar.gz"

mkdir -p "$BACKUP_DIR"

# Container stoppen für konsistentes Backup
cd /mnt/user/appdata/buchhaltung
docker-compose -f unraid-docker-compose.yml stop

# Backup erstellen
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}" \
    -C "$(dirname $SOURCE_DIR)" \
    "$(basename $SOURCE_DIR)" \
    --exclude='buchhaltung/db/data/*' \
    --exclude='buchhaltung/backups/*'

# Container wieder starten
docker-compose -f unraid-docker-compose.yml start

# Alte Backups löschen (älter als 7 Tage)
find "$BACKUP_DIR" -name "buchhaltung_full_*.tar.gz" -mtime +7 -delete

echo "Full backup completed: ${BACKUP_DIR}/${BACKUP_NAME}"
```

### Methode E: Remote-Backup mit Rclone (Offsite-Backup)

Für zusätzliche Sicherheit: Backups in die Cloud synchronisieren.

#### Rclone installieren

```bash
curl https://rclone.org/install.sh | sudo bash
```

#### Rclone konfigurieren

```bash
rclone config
```

Folgen Sie den Anweisungen für Ihren Cloud-Provider (Google Drive, Dropbox, etc.)

#### Sync-Script

```bash
#!/bin/bash
# /mnt/user/appdata/buchhaltung/backup-cloud.sh

# Lokales Backup-Verzeichnis
LOCAL_BACKUP="/mnt/user/backups/buchhaltung"

# Remote-Ziel (passen Sie an Ihre rclone config an)
REMOTE="gdrive:Backups/Buchhaltung"

# Datenbank-Backup erstellen
/mnt/user/appdata/buchhaltung/backup-db.sh

# Uploads sichern
tar -czf /mnt/user/backups/buchhaltung/uploads_$(date +%Y%m%d).tar.gz \
    /mnt/user/appdata/buchhaltung/backend/uploads/

# Zu Cloud synchronisieren
rclone sync "$LOCAL_BACKUP" "$REMOTE" \
    --progress \
    --log-file=/mnt/user/backups/buchhaltung/rclone.log

echo "Cloud backup completed"
```

## Wiederherstellungs-Anleitung

### Vollständige Wiederherstellung

#### Schritt 1: Container stoppen

```bash
cd /mnt/user/appdata/buchhaltung
docker-compose -f unraid-docker-compose.yml down
```

#### Schritt 2: Datenbank wiederherstellen

```bash
# Nur Datenbank-Container starten
docker-compose -f unraid-docker-compose.yml up -d buchhaltung-db

# Warten bis Container bereit ist (ca. 10-15 Sekunden)
sleep 15

# Backup-Datei zum Container kopieren
docker cp /mnt/user/backups/buchhaltung/db_backup_YYYYMMDD_HHMMSS.dump \
    buchhaltung-db:/tmp/restore.dump

# Datenbank leeren und wiederherstellen
docker exec buchhaltung-db psql -U buchhaltung_user -d buchhaltung -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

docker exec buchhaltung-db pg_restore \
    -U buchhaltung_user \
    -d buchhaltung \
    --clean \
    --if-exists \
    /tmp/restore.dump

# Temporäre Datei löschen
docker exec buchhaltung-db rm /tmp/restore.dump

echo "Database restored successfully"
```

#### Schritt 3: Uploads wiederherstellen (falls nötig)

```bash
# Altes Upload-Verzeichnis sichern
mv /mnt/user/appdata/buchhaltung/backend/uploads \
   /mnt/user/appdata/buchhaltung/backend/uploads.old

# Backup extrahieren
tar -xzf /mnt/user/backups/buchhaltung/uploads_YYYYMMDD.tar.gz \
    -C /mnt/user/appdata/buchhaltung/backend/

# Berechtigungen setzen
chmod -R 777 /mnt/user/appdata/buchhaltung/backend/uploads
chown -R 99:100 /mnt/user/appdata/buchhaltung/backend/uploads
```

#### Schritt 4: Alle Container starten

```bash
docker-compose -f unraid-docker-compose.yml up -d
```

#### Schritt 5: Funktionalität prüfen

1. Öffnen Sie `http://<UNRAID-IP>:8082`
2. Melden Sie sich an
3. Prüfen Sie ob alle Daten vorhanden sind
4. Testen Sie Upload-Funktionalität

### Teilweise Wiederherstellung (nur Datenbank)

Wenn nur die Datenbank wiederhergestellt werden soll:

```bash
# Backup einspielen ohne Container zu stoppen
docker exec -i buchhaltung-db pg_restore \
    -U buchhaltung_user \
    -d buchhaltung \
    --clean \
    < /mnt/user/backups/buchhaltung/db_backup_YYYYMMDD_HHMMSS.dump

# Backend neu starten um neue Verbindung herzustellen
docker restart buchhaltung-backend
```

## Backup-Verifikation

### Regelmäßige Tests

Führen Sie monatlich einen Wiederherstellungstest durch:

```bash
# Test-Umgebung erstellen
mkdir -p /tmp/buchhaltung-restore-test
cd /tmp/buchhaltung-restore-test

# Backup wiederherstellen (in Test-Container)
# ... führen Sie Wiederherstellungsschritte durch

# Nach erfolgreichem Test aufräumen
cd /
rm -rf /tmp/buchhaltung-restore-test
```

### Backup-Größe überwachen

Erstellen Sie ein Monitoring-Script:

```bash
#!/bin/bash
# /mnt/user/appdata/buchhaltung/check-backups.sh

BACKUP_DIR="/mnt/user/backups/buchhaltung"
MIN_SIZE=1000000  # 1 MB in Bytes

# Neuestes Backup finden
LATEST_BACKUP=$(ls -t ${BACKUP_DIR}/db_backup_*.dump | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "ERROR: No backup found!"
    exit 1
fi

BACKUP_SIZE=$(stat -c%s "$LATEST_BACKUP")

if [ $BACKUP_SIZE -lt $MIN_SIZE ]; then
    echo "WARNING: Backup is suspiciously small: $BACKUP_SIZE bytes"
    exit 1
fi

echo "Latest backup OK: $(basename $LATEST_BACKUP) - $(du -h $LATEST_BACKUP | cut -f1)"
exit 0
```

## Best Practices

### 3-2-1 Backup-Regel

Empfohlene Backup-Strategie:

1. **3 Kopien:** Original + 2 Backups
   - Original: Laufende Datenbank
   - Backup 1: Lokales Backup auf Unraid Array
   - Backup 2: Offsite-Backup in Cloud

2. **2 verschiedene Medien:**
   - Unraid Array (HDDs)
   - Cloud-Speicher

3. **1 Offsite-Backup:**
   - Cloud (Google Drive, Dropbox, etc.)
   - Oder externer Standort

### Backup-Zeitplan

**Täglich (3:00 Uhr):**
- Datenbank-Backup (pg_dump)
- Upload-Verzeichnis (inkrementell)

**Wöchentlich (Sonntag 2:00 Uhr):**
- Vollständiges Appdata-Backup
- Cloud-Synchronisation

**Monatlich:**
- Wiederherstellungstest
- Backup-Verifikation

### Aufbewahrungsfristen

```
Tägliche Backups:  30 Tage
Wöchentliche:      12 Wochen (3 Monate)
Monatliche:        12 Monate
Jährliche:         5 Jahre (falls rechtlich erforderlich)
```

## Automatisierungs-Zusammenfassung

Komplettes Setup für automatische Backups:

```bash
# 1. User Scripts Plugin installieren
# 2. Scripts hinzufügen:

# Script 1: Täglich um 3:00 Uhr - Datenbank-Backup
# Cron: 0 3 * * *
/mnt/user/appdata/buchhaltung/backup-db.sh

# Script 2: Sonntags um 2:00 Uhr - Vollbackup
# Cron: 0 2 * * 0
/mnt/user/appdata/buchhaltung/backup-full.sh

# Script 3: Sonntags um 4:00 Uhr - Cloud-Sync
# Cron: 0 4 * * 0
/mnt/user/appdata/buchhaltung/backup-cloud.sh

# Script 4: Täglich um 6:00 Uhr - Backup-Verifikation
# Cron: 0 6 * * *
/mnt/user/appdata/buchhaltung/check-backups.sh
```

## Notfall-Wiederherstellung

Im Falle eines kompletten Systemausfalls:

1. Unraid neu installieren
2. Appdata-Share wiederherstellen
3. Docker und Docker Compose installieren
4. Buchhaltung-Verzeichnis aus Backup wiederherstellen
5. Container starten: `docker-compose -f unraid-docker-compose.yml up -d`
6. Funktionalität prüfen

**Wichtig:** Bewahren Sie eine Kopie der `.env` Datei an einem sicheren Ort auf!

## Weitere Ressourcen

- [Unraid Backup-Plugin Dokumentation](https://forums.unraid.net/topic/92462-ca-appdata-backup-restore/)
- [PostgreSQL Backup-Dokumentation](https://www.postgresql.org/docs/current/backup.html)
- [Rclone Dokumentation](https://rclone.org/docs/)
