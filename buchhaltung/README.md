# Buchhaltung Docker - Complete Accounting Application

A complete Docker-based accounting application with frontend (HTML/CSS/JavaScript), backend (Node.js/Express), and PostgreSQL database.

## Features

- ✅ Complete Docker setup with docker-compose
- ✅ PostgreSQL 15+ database with full schema
- ✅ Session-based authentication with bcrypt password hashing
- ✅ User management with roles (Admin/User)
- ✅ Account management with balance tracking
- ✅ Transaction management with PDF file uploads
- ✅ Recurring bookings with interval support
- ✅ PayPal installment plan tracking
- ✅ Monthly reports and category-based charts
- ✅ Responsive design (mobile-optimized)
- ✅ German localization

## Technology Stack

- **Frontend**: HTML, CSS (Vanilla), JavaScript (Vanilla)
- **Backend**: Node.js 18+, Express.js
- **Database**: PostgreSQL 15+
- **Containerisierung**: Docker & Docker Compose
- **Web Server**: Nginx (for frontend)

## Port Configuration

- **Frontend**: http://localhost:8082
- **Backend API**: http://localhost:8079
- **PostgreSQL**: localhost:5432

## Quick Start

### Prerequisites

- Docker 20.10+ 
- Docker Compose 2.0+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AlexDietz82/buchhaltung-docker.git
   cd buchhaltung-docker
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set secure passwords:
   ```env
   POSTGRES_PASSWORD=your_secure_database_password
   SESSION_SECRET=your_very_long_random_session_secret_min_32_chars
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Open browser to http://localhost:8082
   - Complete the initial setup by creating an admin user
   - Login with your credentials

### Stopping the Application

```bash
docker-compose down
```

### Stopping and Removing All Data

```bash
docker-compose down -v
```

## Initial Setup

On first access, you'll be redirected to the setup page where you must create an admin user:

1. Navigate to http://localhost:8082
2. Enter username (3-100 characters)
3. Enter password (minimum 12 characters recommended)
4. Confirm password
5. Click "Admin-Benutzer erstellen"

After setup, you can log in and start using the application.

## Database Schema

The system includes 7 tables:
1. **users** - User accounts with authentication
2. **accounts** - Financial accounts (Giro, Savings, etc.)
3. **transactions** - One-time transactions with file attachments
4. **recurring** - Recurring bookings (monthly, yearly, etc.)
5. **regular_bookings** - Regular bookings (WB/EK)
6. **categories** - Expense/income categories (12 predefined)
7. **files** - File attachments for transactions

## API Endpoints

### Authentication
- `GET /api/auth/admin-exists` - Check if admin exists
- `POST /api/auth/setup` - Create initial admin
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `POST /api/transactions/:id/files` - Upload PDF file
- `GET /api/files/:fileId` - Download file

### Other Endpoints
- `/api/recurring` - Recurring bookings management
- `/api/regular-bookings` - Regular bookings management
- `/api/accounts` - Account management
- `/api/users` - User management (Admin only)
- `/api/categories` - Category management
- `/api/reports/monthly` - Monthly reports
- `/api/reports/charts` - Category charts

## Security Features

- Password hashing with bcrypt (cost 12)
- Session-based authentication
- Rate limiting on auth endpoints (5 attempts/15 min)
- File upload validation (PDF only, max 10MB)
- SQL injection protection (parameterized queries)
- CSRF protection
- Input validation with express-validator

## Development

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Viewing Logs
```bash
docker-compose logs -f
```

### Database Access
```bash
docker-compose exec db psql -U buchhaltung -d buchhaltung
```

## Data Backup

### Backup Database
```bash
docker-compose exec db pg_dump -U buchhaltung buchhaltung > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker-compose exec -T db psql -U buchhaltung buchhaltung
```

### Backup Files
```bash
docker cp buchhaltung-backend:/app/uploads ./uploads-backup
```

## Production Deployment

For production:
1. Set `NODE_ENV=production` in `.env`
2. Use strong passwords for database and session secret
3. Enable HTTPS at reverse proxy level
4. Configure regular database backups
5. Set up log rotation
6. Monitor resource usage

## License

MIT