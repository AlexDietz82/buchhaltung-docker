# Unraid Setup-Anleitung für Buchhaltungsanwendung

Diese Anleitung beschreibt die Installation und Konfiguration der Docker-basierten Buchhaltungsanwendung auf Unraid 7.0.0 oder höher.

## Voraussetzungen

Bevor Sie mit der Installation beginnen, stellen Sie sicher, dass folgende Voraussetzungen erfüllt sind:

- **Unraid Version:** 7.0.0 oder höher
- **Plugins:**
  - Community Applications Plugin (installiert)
  - Docker Compose Manager Plugin (optional, aber empfohlen)
- **Speicher:** Mindestens 2 GB freier Speicher in `/mnt/user/appdata/`
- **Netzwerk:** Zugriff auf Docker Hub für Image-Downloads
- **CPU/RAM:** Mindestens 2 CPU-Kerne und 2 GB RAM empfohlen

## Schritt-für-Schritt Installation

### Option A: Mit Docker Compose Manager Plugin (Empfohlen)

#### Schritt 1: Plugin installieren

1. Öffnen Sie Unraid WebGUI
2. Navigieren Sie zu **Apps** (Community Applications)
3. Suchen Sie nach "Docker Compose Manager"
4. Klicken Sie auf **Install**
5. Warten Sie bis die Installation abgeschlossen ist

#### Schritt 2: Verzeichnisstruktur erstellen

Öffnen Sie ein Terminal (SSH oder Unraid Terminal) und führen Sie folgende Befehle aus:

```bash
# Hauptverzeichnis und Unterverzeichnisse erstellen
mkdir -p /mnt/user/appdata/buchhaltung/{frontend/public,backend/{uploads,app},db/{data,init},backups}

# Schreibrechte für Backend-Uploads setzen
chmod -R 777 /mnt/user/appdata/buchhaltung/backend/uploads

# Schreibrechte für Datenbank setzen
chmod -R 777 /mnt/user/appdata/buchhaltung/db/data

# Owner setzen (Unraid default: nobody:users = 99:100)
chown -R 99:100 /mnt/user/appdata/buchhaltung/
```

#### Schritt 3: Dateien kopieren

1. Laden Sie die `unraid-docker-compose.yml` herunter und speichern Sie sie in:
   ```
   /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml
   ```

2. Erstellen Sie die erforderlichen Konfigurationsdateien (siehe Abschnitt "Konfigurationsdateien" unten)

#### Schritt 4: .env-Datei konfigurieren

Erstellen Sie eine `.env` Datei im Hauptverzeichnis:

```bash
nano /mnt/user/appdata/buchhaltung/.env
```

Fügen Sie folgende Konfiguration ein (und passen Sie die Werte an):

```env
# Database Configuration
DB_HOST=buchhaltung-db
DB_PORT=5432
DB_NAME=buchhaltung
DB_USER=buchhaltung_user
DB_PASSWORD=IhrSicheresPasswortHier123!

# Backend Configuration
NODE_ENV=production
PORT=8079
SESSION_SECRET=EinZufälligerStringMitMindestens32Zeichen123456
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760

# Frontend Configuration
BACKEND_URL=http://buchhaltung-backend:8079

# Timezone
TZ=Europe/Berlin
```

**Wichtig:** Ändern Sie unbedingt `DB_PASSWORD` und `SESSION_SECRET` zu sicheren, zufälligen Werten!

#### Schritt 5: Stack starten über Unraid-UI

1. Öffnen Sie **Docker Compose Manager** in der Unraid WebGUI
2. Klicken Sie auf **Add New Stack**
3. Geben Sie einen Namen ein: `buchhaltung`
4. Wählen Sie die Compose-Datei: `/mnt/user/appdata/buchhaltung/unraid-docker-compose.yml`
5. Klicken Sie auf **Compose Up**
6. Warten Sie, bis alle Container gestartet sind

### Option B: Manuell via Terminal

#### Schritt 1: SSH-Zugang aktivieren

1. Öffnen Sie Unraid WebGUI
2. Navigieren Sie zu **Settings** → **Management Access**
3. Aktivieren Sie **Enable SSH**
4. Verbinden Sie sich via SSH: `ssh root@<UNRAID-IP>`

#### Schritt 2: Verzeichnisstruktur erstellen

```bash
# Alle erforderlichen Verzeichnisse erstellen
mkdir -p /mnt/user/appdata/buchhaltung/{frontend/public,backend/{uploads,app},db/{data,init},backups}

# Berechtigungen setzen
chmod -R 777 /mnt/user/appdata/buchhaltung/backend/uploads
chmod -R 777 /mnt/user/appdata/buchhaltung/db/data
chown -R 99:100 /mnt/user/appdata/buchhaltung/
```

#### Schritt 3: Repository klonen oder Dateien kopieren

```bash
# In das Appdata-Verzeichnis wechseln
cd /mnt/user/appdata/buchhaltung/

# Compose-Datei und Konfigurationen erstellen (siehe oben)
```

#### Schritt 4: Docker Compose ausführen

```bash
cd /mnt/user/appdata/buchhaltung/
docker-compose -f unraid-docker-compose.yml up -d
```

#### Schritt 5: Autostart konfigurieren (User Scripts Plugin)

1. Installieren Sie das "User Scripts" Plugin aus Community Applications
2. Erstellen Sie ein neues Script:

```bash
#!/bin/bash
# Name: Start Buchhaltung
cd /mnt/user/appdata/buchhaltung/
docker-compose -f unraid-docker-compose.yml up -d
```

3. Setzen Sie den Schedule auf: **At Startup of Array**

## Verzeichnisstruktur

Nach der Installation sollte die Verzeichnisstruktur wie folgt aussehen:

```
/mnt/user/appdata/buchhaltung/
├── unraid-docker-compose.yml    # Docker Compose Konfiguration
├── .env                          # Umgebungsvariablen
├── frontend/
│   ├── nginx.conf                # Nginx-Konfiguration
│   └── public/                   # Frontend-Dateien (HTML/CSS/JS)
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── backend/
│   ├── uploads/                  # Upload-Verzeichnis (Schreibrechte erforderlich)
│   ├── .env                      # Backend-spezifische Env-Variablen (optional)
│   └── app/                      # Backend-Anwendungscode
│       ├── package.json
│       ├── server.js
│       └── ...
├── db/
│   ├── data/                     # PostgreSQL Datenbankdaten (Schreibrechte erforderlich)
│   └── init/                     # Initialisierungs-SQL-Skripte
│       └── init.sql
└── backups/                      # Backup-Verzeichnis (optional)
```

## Konfigurationsdateien

### Frontend: nginx.conf

Erstellen Sie `/mnt/user/appdata/buchhaltung/frontend/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api {
            proxy_pass http://buchhaltung-backend:8079;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### Datenbank: init.sql

Erstellen Sie `/mnt/user/appdata/buchhaltung/db/init/init.sql`:

```sql
-- Buchhaltung Database Initialization

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables (example structure)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_documents_transaction_id ON documents(transaction_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO buchhaltung_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO buchhaltung_user;
```

### Backend: .env (optional, zusätzlich zur Haupt-.env)

Falls Sie backend-spezifische Variablen benötigen, erstellen Sie:
`/mnt/user/appdata/buchhaltung/backend/.env`

```env
# Diese Datei ist optional und überschreibt die Haupt-.env für den Backend-Container
PORT=8079
NODE_ENV=production
```

## Netzwerk-Zugriff

### Interne Kommunikation

Die Container kommunizieren intern über das Docker-Netzwerk `buchhaltung-network`:
- Frontend → Backend: `http://buchhaltung-backend:8079`
- Backend → Datenbank: `buchhaltung-db:5432`

### Externer Zugriff

Nach erfolgreicher Installation können Sie auf die Anwendung zugreifen:

- **Frontend (WebUI):** `http://<UNRAID-IP>:8082`
- **Backend-API:** `http://<UNRAID-IP>:8079`
- **Datenbank:** `<UNRAID-IP>:5432` (nur für externe Tools wie pgAdmin)

Ersetzen Sie `<UNRAID-IP>` mit der tatsächlichen IP-Adresse Ihres Unraid-Servers.

## Reverse Proxy Integration (Optional)

Für sichere externe Zugriffe über HTTPS empfiehlt sich ein Reverse Proxy.

### Option 1: nginx Proxy Manager (Empfohlen)

1. Installieren Sie "nginx Proxy Manager" aus Community Applications
2. Konfigurieren Sie einen neuen Proxy Host:
   - **Domain Names:** `buchhaltung.ihredomain.de`
   - **Scheme:** `http`
   - **Forward Hostname/IP:** `<UNRAID-IP>`
   - **Forward Port:** `8082`
   - **SSL:** Aktivieren Sie "Force SSL" und "Request a new SSL Certificate"

### Option 2: Traefik

Fügen Sie Labels zu den Services in `unraid-docker-compose.yml` hinzu:

```yaml
services:
  buchhaltung-frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.buchhaltung.rule=Host(`buchhaltung.ihredomain.de`)"
      - "traefik.http.routers.buchhaltung.entrypoints=websecure"
      - "traefik.http.routers.buchhaltung.tls.certresolver=letsencrypt"
      - "traefik.http.services.buchhaltung.loadbalancer.server.port=80"
```

### Option 3: Caddy

Erstellen Sie eine Caddyfile:

```caddyfile
buchhaltung.ihredomain.de {
    reverse_proxy <UNRAID-IP>:8082
}
```

## Status-Überprüfung

Prüfen Sie ob alle Container laufen:

```bash
docker ps | grep buchhaltung
```

Sie sollten drei laufende Container sehen:
- `buchhaltung-frontend`
- `buchhaltung-backend`
- `buchhaltung-db`

Überprüfen Sie die Logs:

```bash
# Alle Container
docker-compose -f /mnt/user/appdata/buchhaltung/unraid-docker-compose.yml logs

# Einzelner Container
docker logs buchhaltung-frontend
docker logs buchhaltung-backend
docker logs buchhaltung-db
```

## Erste Schritte nach der Installation

1. Öffnen Sie `http://<UNRAID-IP>:8082` in Ihrem Browser
2. Erstellen Sie einen Admin-Account (falls die Anwendung dies vorsieht)
3. Konfigurieren Sie die Anwendung nach Ihren Bedürfnissen
4. Richten Sie regelmäßige Backups ein (siehe UNRAID-BACKUP.md)

## Nächste Schritte

- Lesen Sie die [Backup-Anleitung](UNRAID-BACKUP.md) für Datensicherung
- Konsultieren Sie den [Troubleshooting-Guide](UNRAID-TROUBLESHOOTING.md) bei Problemen
- Informieren Sie sich über [Update-Prozeduren](UNRAID-UPDATE.md)

## Sicherheitshinweise

- **Ändern Sie alle Standard-Passwörter** in der `.env` Datei
- **Verwenden Sie sichere Passwörter** (mindestens 16 Zeichen, Groß-/Kleinschreibung, Zahlen, Sonderzeichen)
- **Beschränken Sie den Datenbankzugang** (Port 5432) nur auf vertrauenswürdige IPs oder deaktivieren Sie den externen Zugriff
- **Verwenden Sie HTTPS** über einen Reverse Proxy für externen Zugriff
- **Führen Sie regelmäßige Backups** durch
- **Halten Sie die Container-Images aktuell** (siehe UNRAID-UPDATE.md)

## Support und Hilfe

Bei Problemen:
1. Überprüfen Sie die Container-Logs
2. Konsultieren Sie den [Troubleshooting-Guide](UNRAID-TROUBLESHOOTING.md)
3. Prüfen Sie die Berechtigungen der Verzeichnisse
4. Stellen Sie sicher, dass alle Ports verfügbar sind
