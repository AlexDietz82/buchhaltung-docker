# Buchhaltung Docker

Eine vollständige Docker-basierte Buchhaltungsanwendung mit Frontend, Backend und PostgreSQL-Datenbank.

## Übersicht

Diese Anwendung bietet eine komplette Buchhaltungslösung, die als Docker-Container-Stack betrieben wird:

- **Frontend:** Webbasierte Benutzeroberfläche (nginx)
- **Backend:** API-Server für Geschäftslogik (Node.js)
- **Datenbank:** PostgreSQL für Datenspeicherung

## Installation

### Standard Docker Compose

```bash
docker-compose up -d
```

### Unraid 7.0.0

Für Unraid-Benutzer gibt es optimierte Konfigurationen und ausführliche Anleitungen:

#### Schnellstart

1. Erstellen Sie die Verzeichnisstruktur:
   ```bash
   mkdir -p /mnt/user/appdata/buchhaltung/{frontend/public,backend/{uploads,app},db/{data,init},backups}
   chmod -R 777 /mnt/user/appdata/buchhaltung/backend/uploads
   chmod -R 777 /mnt/user/appdata/buchhaltung/db/data
   chown -R 99:100 /mnt/user/appdata/buchhaltung/
   ```

2. Kopieren Sie die `unraid-docker-compose.yml` nach `/mnt/user/appdata/buchhaltung/`

3. Erstellen Sie eine `.env` Datei (siehe [UNRAID-SETUP.md](UNRAID-SETUP.md))

4. Starten Sie den Stack:
   ```bash
   cd /mnt/user/appdata/buchhaltung
   docker-compose -f unraid-docker-compose.yml up -d
   ```

#### Unraid-Dokumentation

- **[UNRAID-SETUP.md](UNRAID-SETUP.md)** - Vollständige Installationsanleitung
- **[UNRAID-BACKUP.md](UNRAID-BACKUP.md)** - Backup- und Wiederherstellungsstrategien
- **[UNRAID-TROUBLESHOOTING.md](UNRAID-TROUBLESHOOTING.md)** - Problemlösung und Diagnose
- **[UNRAID-UPDATE.md](UNRAID-UPDATE.md)** - Update-Prozeduren

#### Unraid-Templates

Für die einzelne Container-Verwaltung über die Unraid-UI finden Sie XML-Templates im Verzeichnis `templates/`:

- `buchhaltung-frontend.xml`
- `buchhaltung-backend.xml`
- `buchhaltung-db.xml`

## Zugriff

Nach der Installation erreichen Sie die Anwendung unter:

- **Frontend (WebUI):** `http://<SERVER-IP>:8082`
- **Backend-API:** `http://<SERVER-IP>:8079`
- **Datenbank:** `<SERVER-IP>:5432` (für externe Tools wie pgAdmin)

## Architektur

```
┌─────────────────┐
│   Frontend      │  nginx:alpine
│   Port: 8082    │  (Web-Interface)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend       │  node:18-alpine
│   Port: 8079    │  (API-Server)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Database      │  postgres:15-alpine
│   Port: 5432    │  (Datenspeicherung)
└─────────────────┘
```

## Komponenten

### Frontend
- **Image:** nginx:alpine
- **Port:** 8082 → 80
- **Funktion:** Stellt die Benutzeroberfläche bereit
- **Volumes:** nginx.conf, HTML/CSS/JS-Dateien

### Backend
- **Image:** node:18-alpine
- **Port:** 8079
- **Funktion:** API-Server, Geschäftslogik
- **Volumes:** Anwendungscode, Upload-Verzeichnis, .env

### Datenbank
- **Image:** postgres:15-alpine
- **Port:** 5432
- **Funktion:** Speichert alle Finanzdaten
- **Volumes:** Datenbankdaten, Initialisierungsskripte

## Sicherheit

- **Ändern Sie alle Standard-Passwörter** in der `.env` Datei
- **Verwenden Sie sichere Passwörter** (mindestens 16 Zeichen)
- **Beschränken Sie den Datenbankzugang** nur auf vertrauenswürdige IPs
- **Verwenden Sie HTTPS** über einen Reverse Proxy
- **Führen Sie regelmäßige Backups** durch

## Support

Bei Problemen konsultieren Sie:
1. Die entsprechenden Dokumentationsdateien (siehe oben)
2. GitHub Issues: https://github.com/AlexDietz82/buchhaltung-docker/issues

## Lizenz

Siehe LICENSE-Datei für Details.