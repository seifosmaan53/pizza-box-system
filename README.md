# Pizza Box Inventory & Invoicing System

A full-stack, production-grade web application for managing pizza box inventory, creating invoices, and tracking business analytics. Built for a company with partners in the United States and Egypt.

---

## Features

- **Inventory Management** — Track box inventory per store, by box type and size
- **Invoicing** — Create, send, and manage professional invoices with PDF generation
- **Analytics** — Revenue charts, top stores, best-selling products
- **Low Stock Alerts** — Automatic alerts when inventory drops below thresholds
- **Multi-Currency** — USD for US stores, EGP for Egypt stores
- **AI Assistant** — Chat with an AI that has live knowledge of your entire inventory and invoices
- **Role-Based Access** — Admin, Manager, and Viewer roles
- **Audit Log** — Full history of every action in the system
- **Dark Mode** — Full dark mode support

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Docker | 24+ |
| Docker Compose | v2+ |
| PostgreSQL | 15+ (if running without Docker) |
| Redis | 7+ (if running without Docker) |

---

## Quick Start (Docker)

```bash
# 1. Clone and enter the project
git clone <your-repo-url> pizza-box-system
cd pizza-box-system

# 2. Set up environment
cp .env.example .env
# Edit .env — required: POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Start everything
docker-compose up -d

# 4. Run migrations and seed
docker exec pizzabox_server npm run prisma:migrate
docker exec pizzabox_server npm run prisma:seed
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

---

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `POSTGRES_PASSWORD` | ✅ | PostgreSQL password (used by Docker Compose) | `generate with: openssl rand -hex 32` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://postgres:pass@localhost:5432/pizzabox` |
| `JWT_SECRET` | ✅ | Secret for access tokens (min 32 chars) | `generate with: openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | ✅ | Secret for refresh tokens (different from JWT_SECRET) | `generate with: openssl rand -hex 64` |
| `REDIS_HOST` | ✅ | Redis server hostname | `localhost` |
| `REDIS_PORT` | ✅ | Redis server port | `6379` |
| `REDIS_PASSWORD` | ✅ | Redis password (required when using Docker Compose) | `generate with: openssl rand -base64 32` |
| `PORT` | ❌ | Server port | `3001` |
| `NODE_ENV` | ❌ | Environment | `development` |
| `CLIENT_URL` | ❌ | Frontend URL for CORS | `http://localhost:5173` |
| `ANTHROPIC_API_KEY` | ❌ | Anthropic API key for AI assistant | `sk-ant-...` |
| `INVOICE_PREFIX` | ❌ | Prefix for invoice numbers | `INV` |
| `SMTP_HOST` | ❌ | SMTP server for password reset emails | `smtp.gmail.com` |
| `SMTP_PORT` | ❌ | SMTP port | `587` |
| `SMTP_SECURE` | ❌ | Use TLS for SMTP (`true` for port 465) | `false` |
| `SMTP_USER` | ❌ | SMTP username | `your@email.com` |
| `SMTP_PASS` | ❌ | SMTP password or app password | `xxxx xxxx xxxx xxxx` |
| `EMAIL_FROM` | ❌ | From address for system emails | `noreply@yourcompany.com` |
| `VITE_API_URL` | ❌ | API URL for frontend | `http://localhost:3001/api` |

---

## Manual Setup (without Docker)

### 1. Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Set up the database

```bash
# Make sure PostgreSQL is running and create the database
createdb pizzabox

# Copy and fill in your .env
cp ../.env.example ../.env
# Set DATABASE_URL=postgresql://your_user:your_pass@localhost:5432/pizzabox
```

### 3. Run migrations and seed

```bash
cd server
npx prisma migrate dev --name init
npm run prisma:seed
```

### 4. Start the servers

```bash
# Backend (in server/)
npm run dev

# Frontend (in client/, separate terminal)
cd ../client
npm run dev
```

---

## Database Operations

```bash
# Run migrations
cd server && npx prisma migrate dev

# Seed the database with demo data
npm run prisma:seed

# Reset everything and re-seed
npm run prisma:reset

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate
```

---

## Default Credentials (after seeding)

| Email | Password | Role |
|-------|----------|------|
| admin@company.com | Admin123! | ADMIN |
| manager@company.com | Manager123! | MANAGER |
| viewer@company.com | Viewer123! | VIEWER |

**Change these immediately in production.**

---

## Deployment (VPS with Nginx + PM2)

### 1. Server setup

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install PostgreSQL and Redis
sudo apt-get install -y postgresql redis-server
```

### 2. Build and deploy

```bash
# Backend
cd server
npm install --production
npx prisma migrate deploy
npm run build
pm2 start dist/server.js --name pizzabox-api

# Frontend
cd ../client
npm install
VITE_API_URL=https://yourdomain.com/api npm run build
# Copy dist/ to your web server root
```

### 3. Nginx configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/pizzabox/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Save PM2 config

```bash
pm2 save
pm2 startup
```

---

## Adding Your First Production Admin User

After deploying without seeding (production), create your admin user:

```bash
cd server
node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('YourSecurePassword123!', 10);
  await prisma.user.create({
    data: {
      email: 'your@email.com',
      passwordHash: hash,
      firstName: 'Your',
      lastName: 'Name',
      role: 'ADMIN',
    }
  });
  console.log('Admin user created');
  await prisma.\$disconnect();
}
main();
"
```

---

## AI Assistant Setup

1. Get your Anthropic API key from https://console.anthropic.com
2. Add to your `.env`: `ANTHROPIC_API_KEY=sk-ant-...`
3. Restart the server

The AI assistant appears as a floating chat button in the bottom-right corner of every page. It receives a live snapshot of your entire business data with every message — inventory levels, invoice statuses, store performance, and more.

---

## Troubleshooting

**`Set POSTGRES_PASSWORD in .env` error on `docker-compose up`**
→ The Docker setup requires explicit passwords. Add `POSTGRES_PASSWORD=your_strong_password` and `REDIS_PASSWORD=your_redis_password` to your `.env` file.

**`DATABASE_URL` error on startup**
→ Make sure PostgreSQL is running and the connection string in `.env` is correct. Test with: `psql $DATABASE_URL`

**Redis connection failed**
→ Make sure Redis is running: `redis-cli ping` should return `PONG`

**Prisma migration error: "relation does not exist"**
→ Run `npx prisma migrate deploy` to apply pending migrations

**PDF generation fails**
→ Puppeteer needs Chrome. In Docker, it's pre-installed. On a VPS: `sudo apt-get install -y chromium-browser`

**AI chat returns "API key not configured"**
→ Add `ANTHROPIC_API_KEY` to your `.env` and restart the server

**Login returns "Account locked"**
→ Wait 15 minutes, or clear the Redis key: `redis-cli del login_attempts:your@email.com`

**Frontend shows "Cannot connect to server"**
→ Check that `VITE_API_URL` in `.env` points to the correct backend URL and the server is running

---

## Project Structure

```
pizza-box-system/
├── client/                  # React 18 + TypeScript frontend
│   └── src/
│       ├── api/             # Axios API calls (one file per domain)
│       ├── components/      # Reusable UI components
│       ├── pages/           # Page components
│       ├── store/           # Zustand global state
│       ├── hooks/           # Custom React hooks
│       ├── types/           # TypeScript types
│       └── utils/           # Formatters and helpers
├── server/                  # Node.js + Express + TypeScript backend
│   └── src/
│       ├── controllers/     # Request handlers
│       ├── routes/          # Express route definitions
│       ├── middleware/       # Auth, validation, error handling
│       ├── utils/           # Helpers (JWT, audit log, etc.)
│       ├── jobs/            # Cron jobs
│       └── prisma/          # Seed script
│   └── prisma/
│       └── schema.prisma    # Database schema
├── shared/                  # Shared TypeScript types
├── docker-compose.yml       # Development Docker setup
├── docker-compose.prod.yml  # Production Docker setup
└── .env.example             # Environment variable template
```

---

## License

Private — all rights reserved.
