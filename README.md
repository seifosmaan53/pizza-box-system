# Pizza Box Inventory & Invoicing System

<!--portfolio-note-->
> **Portfolio note —** one of three invoicing builds I made to explore the same problem with different stacks. **This is the React + Express + Prisma full-stack take.** Siblings: [asset-vault](https://github.com/seifosmaan53/asset-vault) (React 19 + NestJS 11 + tRPC) and [invoiceme](https://github.com/seifosmaan53/invoiceme) (Flutter mobile + NestJS, offline-first).

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=flat&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red?style=flat)

A production-grade, full-stack web application for managing pizza box inventory across multiple stores, generating professional PDF invoices, and tracking business analytics — with an AI assistant that has live access to all business data.

Built to solve a real operations problem: a company with US-based stores managed from Egypt needed a centralized, role-aware system that could replace spreadsheets and manual invoicing. The result is a deployable SaaS-style platform with zero compromises on security or reliability.

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Key Engineering Decisions](#key-engineering-decisions)
- [Security](#security)
- [Performance](#performance)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [What I Learned](#what-i-learned)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Client                           │
│   React 18 + TypeScript + Vite + TanStack Query         │
│   Zustand state │ React Hook Form │ Recharts            │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS / REST
                     ┌──────▼──────┐
                     │    Nginx    │  (reverse proxy, SSL termination,
                     │             │   AI streaming buffer disabled)
                     └──────┬──────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                      API Server                         │
│   Express 4 + TypeScript                                │
│   JWT auth │ Rate limiting │ RBAC middleware             │
│   Zod validation │ Helmet │ Winston logging              │
└──────┬──────────────────────────────────┬───────────────┘
       │                                  │
┌──────▼──────┐                  ┌────────▼───────┐
│ PostgreSQL  │                  │     Redis       │
│   Prisma    │                  │  Sessions +     │
│    ORM      │                  │  Rate limit     │
│  (10 models │                  │  counters       │
│  + indexes) │                  └────────────────┘
└─────────────┘
       │
┌──────▼──────┐
│  Anthropic  │
│   Claude    │  (AI assistant with live DB snapshot)
└─────────────┘
```

The backend follows a **controller → service → repository** pattern with strict separation between routing, business logic, and data access. Every request passes through auth verification, role checking, input sanitization, and Zod schema validation before reaching a controller.

---

## Features

### Inventory Management
- Per-store inventory tracking by box type and size
- Warehouse view: cross-store aggregated stock levels
- Full transaction audit trail (add, remove, invoice deduction, restore, adjustment)
- Automatic low-stock alerts with configurable thresholds
- Reserved quantity tracking to prevent overselling

### Invoicing
- Full invoice lifecycle: `DRAFT → SENT → PAID / OVERDUE / CANCELLED`
- Professional PDF generation (Puppeteer + headless Chrome)
- Sequential invoice numbering with yearly counter reset (`INV-2026-00001`)
- Automatic inventory deduction on send, restore on cancel
- Automatic overdue detection via hourly cron job
- Email delivery with SMTP (password reset + invoice notifications)
- Per-store tax rates and configurable shipping fees
- Public and internal notes per invoice

### Analytics
- Revenue totals by status (DRAFT, SENT, PAID, OVERDUE)
- Monthly revenue trend charts
- Top stores ranked by total sales
- Best-selling products by quantity and revenue
- Dashboard KPIs: open invoice count, overdue alerts, warehouse stock level

### AI Business Assistant
- Floating chat widget powered by Anthropic Claude
- Receives a live snapshot of inventory, invoices, and store performance with every message
- Streaming responses (nginx buffering disabled for real-time output)
- Role-aware data access — Viewers get aggregated data, Admins get full context

### Multi-User Access Control
| Role | Permissions |
|------|-------------|
| ADMIN | Full access: users, settings, all data, audit log |
| MANAGER | Create/edit invoices, inventory, stores |
| VIEWER | Read-only: dashboards and analytics only |

### Additional
- Full audit log: every create/update/delete logged with user ID, IP, timestamp, and diff
- Dark mode (system preference + manual toggle)
- CSV export for inventory and invoices
- Keyboard shortcuts
- Offline detection banner
- Session timeout warning with auto-logout
- Onboarding checklist on first login

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3 | UI framework |
| TypeScript | 5.5 | Type safety end-to-end |
| Vite | 5.3 | Build tool and dev server |
| TanStack Query | 5.50 | Server state, caching, background refetch |
| Zustand | 4.5 | Client-only global state (auth, UI) |
| React Hook Form + Zod | 7.52 / 3.23 | Form management and schema validation |
| Tailwind CSS | 3.4 | Utility-first styling |
| Recharts | 2.12 | Analytics charts |
| @react-pdf/renderer | 3.4 | Client-side PDF preview |
| Anthropic SDK | 0.27 | AI assistant streaming |
| Axios | 1.7 | HTTP client with interceptors |
| Lucide React | — | Icon library |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | Runtime |
| Express | 4.19 | HTTP framework |
| TypeScript | 5.5 | Type safety |
| Prisma ORM | 5.14 | Database access and migrations |
| PostgreSQL | 15+ | Primary data store |
| Redis | 7+ | Session data, rate limit counters |
| Puppeteer | 22.12 | Server-side PDF generation |
| Nodemailer | 6.9 | Email delivery |
| node-cron | 3.0 | Scheduled jobs (overdue detection, low-stock snapshots) |
| Zod | 3.23 | Runtime schema validation |
| JWT + bcryptjs | — | Authentication and password hashing |
| Helmet | 7.1 | HTTP security headers |
| Winston + Morgan | — | Structured logging |
| Swagger/OpenAPI | — | Auto-generated API documentation |
| Anthropic SDK | 0.27 | AI assistant integration |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| Docker + Docker Compose | Containerized local and production environments |
| Nginx | Reverse proxy, SSL termination, streaming support |
| PM2 | Production Node.js process manager |

---

## Key Engineering Decisions

**1. Prisma over raw SQL**
Prisma was chosen for its type-safe query builder, automatic migration history, and Prisma Studio (visual DB browser for dev). Every DB query is fully typed — a typo in a field name is a compile error, not a runtime bug.

**2. TanStack Query over Redux for server state**
Redux would have required manually managing loading/error/success states for every API call. TanStack Query gives stale-while-revalidate caching, background refetch, automatic deduplication, and optimistic updates — all without custom reducers.

**3. Zustand for client state, TanStack Query for server state**
Keeping these separate means the auth store and UI state live in Zustand (never stale, never refetched), while all data that comes from the API goes through TanStack Query. This prevents the common pattern of storing API responses in Redux and manually invalidating them.

**4. Decimal.js for all monetary arithmetic**
JavaScript floating point cannot represent most decimal fractions exactly. `0.1 + 0.2 === 0.30000000000000004`. All invoice calculations — line totals, tax, shipping, grand total — use `Decimal.js` to guarantee correct results regardless of how many items are on the invoice.

**5. Puppeteer for PDF generation (server-side)**
Client-side PDF generation (`@react-pdf/renderer`) was kept for preview in the browser. For the actual PDF file that gets stored and emailed, Puppeteer renders the invoice as HTML in a headless Chrome instance on the server. This guarantees pixel-perfect output that matches exactly what the user sees in the browser.

**6. Reserved quantity field on inventory items**
When an invoice is created with items, those quantities are moved into `reservedQuantity` rather than deducted immediately. The deduction only happens on send. If an invoice is cancelled, the reserved quantity is restored. This prevents inventory from being silently reduced while invoices sit as drafts.

**7. Hard-fail passwords in Docker Compose**
The `:?error` syntax in `docker-compose.yml` causes Docker to refuse to start if `POSTGRES_PASSWORD` or `REDIS_PASSWORD` are not set. This eliminates the risk of accidentally running with weak default credentials copied from an old config.

---

## Security

- **Authentication**: JWT access tokens (15 min) + refresh tokens (7 days), stored in httpOnly cookies with `sameSite=lax`
- **Brute force protection**: Login rate-limited to 5 attempts per 15 minutes per IP, tracked in Redis
- **Password hashing**: bcrypt with cost factor 10
- **Input sanitization**: All request body fields stripped of XSS payloads before reaching controllers
- **SQL injection**: Prevented by Prisma's parameterized query builder (no raw SQL in hot paths)
- **HTTP headers**: Helmet sets strict CSP, X-Frame-Options, X-Content-Type-Options, HSTS
- **CORS**: Strict origin allowlist — only `CLIENT_URL` is permitted
- **Rate limiting**: 100 requests per 15 minutes globally; stricter limits on auth routes
- **Proxy trust**: Express `trust proxy: 1` enabled so rate limiting reads real client IPs behind Nginx, not the proxy IP
- **Audit log**: Every write operation records user ID, action type, entity, before/after state, and client IP

---

## Performance

- **Database indexes**: 10+ indexes on frequently queried columns (store ID, invoice status, created date, user ID)
- **Redis caching**: Session data and rate limit counters are in-memory, never hitting the DB on every request
- **TanStack Query**: Aggressive client-side caching with configurable `staleTime`; list and detail queries share normalized cache
- **Pagination**: All list endpoints paginate — no endpoint loads an unbounded result set
- **Lazy loading**: React routes are code-split with `React.lazy()` — the dashboard bundle does not include the invoice PDF renderer
- **Prisma select**: Controllers select only the columns they need — no `SELECT *` on large tables
- **Gzip compression**: Express `compression` middleware applied to all responses
- **AI streaming**: Nginx buffering disabled on the AI route so the first token appears immediately instead of waiting for the full response

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Docker | 24+ |
| Docker Compose | v2+ |

### Docker Setup (recommended)

```bash
# 1. Clone the repository
git clone https://github.com/seifosmaan53/pizza-box-system.git
cd pizza-box-system

# 2. Set up environment
cp .env.example .env
```

Open `.env` and set these four required values before continuing:

```env
POSTGRES_PASSWORD=your_strong_db_password
REDIS_PASSWORD=your_strong_redis_password
JWT_SECRET=         # generate: openssl rand -hex 64
JWT_REFRESH_SECRET= # generate: openssl rand -hex 64  (must differ from JWT_SECRET)
```

```bash
# 3. Start all services (PostgreSQL, Redis, API, frontend)
docker-compose up -d

# 4. Run migrations and seed demo data
docker exec pizzabox_server npm run prisma:migrate
docker exec pizzabox_server npm run prisma:seed
```

**App is now running:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Docs (Swagger): http://localhost:3001/api-docs

### Default Login Credentials

> **Change these immediately. Do not use in production.**

| Email | Password | Role |
|-------|----------|------|
| admin@company.com | Admin123! | ADMIN |
| manager@company.com | Manager123! | MANAGER |
| viewer@company.com | Viewer123! | VIEWER |

---

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `POSTGRES_PASSWORD` | ✅ | PostgreSQL password (Docker Compose) | `openssl rand -hex 32` |
| `DATABASE_URL` | ✅ | Full PostgreSQL connection string | `postgresql://postgres:pass@localhost:5432/pizzabox` |
| `JWT_SECRET` | ✅ | Access token signing secret (64+ chars) | `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token secret — must differ from above | `openssl rand -hex 64` |
| `REDIS_HOST` | ✅ | Redis hostname | `localhost` |
| `REDIS_PORT` | ✅ | Redis port | `6379` |
| `REDIS_PASSWORD` | ✅ | Redis password (required for Docker) | `openssl rand -base64 32` |
| `PORT` | ❌ | API server port | `3001` |
| `NODE_ENV` | ❌ | Environment (`development` / `production`) | `development` |
| `CLIENT_URL` | ❌ | Frontend origin for CORS | `http://localhost:5173` |
| `ANTHROPIC_API_KEY` | ❌ | Enables AI assistant (get at console.anthropic.com) | `sk-ant-...` |
| `INVOICE_PREFIX` | ❌ | Invoice number prefix | `INV` |
| `SMTP_HOST` | ❌ | SMTP server (password reset + invoice emails) | `smtp.gmail.com` |
| `SMTP_PORT` | ❌ | SMTP port | `587` |
| `SMTP_SECURE` | ❌ | `true` for port 465, `false` for 587 | `false` |
| `SMTP_USER` | ❌ | SMTP username / email | `your@email.com` |
| `SMTP_PASS` | ❌ | SMTP password or Gmail App Password | `xxxx xxxx xxxx xxxx` |
| `EMAIL_FROM` | ❌ | From address for outbound emails | `noreply@yourcompany.com` |
| `VITE_API_URL` | ❌ | API URL exposed to the browser | `http://localhost:3001/api` |

---

## Database

### Schema overview

| Model | Purpose |
|-------|---------|
| `User` | Authentication, roles, lockout state |
| `Store` | Location, tax rate, default shipping fee |
| `BoxType` | Product category (e.g. "Regular", "Premium") |
| `BoxSize` | Dimensions and display order |
| `InventoryItem` | Per-store stock with reserved quantity tracking |
| `InventoryTransaction` | Full audit trail of every stock movement |
| `Invoice` | Lifecycle state, totals, timestamps |
| `InvoiceLineItem` | Snapshotted line items with inventory deduction |
| `InvoiceCounter` | Sequential yearly invoice numbering |
| `Product` | General product catalog |
| `ProductStock` | Per-store product quantities |
| `AuditLog` | All user actions with IP, diff, timestamp |
| `AppSettings` | System-wide configuration |
| `PasswordResetToken` | Self-expiring password reset tokens |

### Common operations

```bash
# Run pending migrations
cd server && npx prisma migrate dev

# Open Prisma Studio (visual browser — dev only)
npx prisma studio

# Seed with demo data (wipes existing data first)
npm run prisma:seed

# Reset database and re-seed
npm run prisma:reset

# Regenerate Prisma client after schema changes
npx prisma generate
```

---

## API Documentation

Swagger UI is served at `/api-docs` when the server is running.

All endpoints are documented with:
- Request body schemas
- Response schemas
- Authentication requirements
- Error codes

---

## Deployment

### VPS with Nginx + PM2

#### 1. Install dependencies

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql redis-server
sudo npm install -g pm2
```

#### 2. Build and run

```bash
# Backend
cd server
npm install --production
npx prisma migrate deploy
npm run build
pm2 start dist/server.js --name pizzabox-api
pm2 save && pm2 startup

# Frontend
cd ../client
npm install
VITE_API_URL=https://yourdomain.com/api npm run build
# Serve client/dist/ with Nginx
```

#### 3. Nginx configuration

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

    # Disable buffering for AI streaming endpoint
    location /api/ai {
        proxy_pass http://localhost:3001;
        proxy_buffering off;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 4. Create first admin user (production — no seed data)

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
  console.log('Admin created');
  await prisma.\$disconnect();
}
main();
"
```

---

## Troubleshooting

**`Set POSTGRES_PASSWORD in .env` on `docker-compose up`**
→ Docker requires explicit passwords. Add `POSTGRES_PASSWORD` and `REDIS_PASSWORD` to your `.env` file.

**`DATABASE_URL` error on startup**
→ Verify PostgreSQL is running: `psql $DATABASE_URL`

**Redis connection failed**
→ `redis-cli ping` should return `PONG`. Check `REDIS_PASSWORD` matches docker-compose config.

**Prisma migration error: "relation does not exist"**
→ `npx prisma migrate deploy`

**PDF generation fails**
→ Puppeteer needs a Chrome binary. In Docker it's pre-installed. On a VPS: `sudo apt-get install -y chromium-browser`

**AI chat returns "API key not configured"**
→ Set `ANTHROPIC_API_KEY` in `.env` and restart the server.

**AI responses appear all at once instead of streaming**
→ Add `proxy_buffering off;` to the Nginx location block for `/api/ai`.

**Login returns "Account locked"**
→ Wait 15 minutes, or clear the counter: `redis-cli del login_attempts:your@email.com`

---

## Project Structure

```
pizza-box-system/
├── client/                        # React 18 + TypeScript frontend (Vite)
│   └── src/
│       ├── api/                   # Axios API calls — one file per domain
│       ├── components/            # Reusable UI components + layout + AI chat
│       ├── pages/                 # Page components (Dashboard, Invoices, Inventory, etc.)
│       ├── store/                 # Zustand stores (auth, UI, AI chat)
│       ├── hooks/                 # Custom hooks (auth, permissions, keyboard shortcuts)
│       ├── types/                 # TypeScript type definitions
│       └── utils/                 # Formatters, CSV export, constants
│
├── server/                        # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── controllers/           # Request handlers — business logic lives here
│   │   ├── routes/                # Express route definitions
│   │   ├── middleware/            # Auth, RBAC, validation, rate limiting, sanitization
│   │   ├── jobs/                  # Cron jobs (overdue detection, low-stock snapshots)
│   │   ├── utils/                 # JWT helpers, audit logger, email, Winston config
│   │   └── prisma/                # Seed and reset scripts
│   └── prisma/
│       ├── schema.prisma          # Database schema (14 models)
│       └── migrations/            # Migration history
│
├── shared/                        # Shared TypeScript types used by both client and server
├── nginx/                         # Nginx configuration
├── docker-compose.yml             # Development environment (4 services)
├── docker-compose.prod.yml        # Production environment
└── .env.example                   # Environment variable template with documentation
```

---

## What I Learned

Building this from scratch end-to-end taught me how the pieces of a real production system fit together in ways that tutorials don't show:

**Full-stack TypeScript discipline** — Keeping types consistent across the frontend, backend, and shared package meant any schema change in the database immediately surfaced as a compile error in the API controller and the React component consuming it. The investment in shared types pays off compounding.

**State management belongs to two separate layers** — Server state (data that lives in the database) and client state (UI toggles, auth session) have completely different requirements. Mixing them in Redux creates a permanent invalidation problem. TanStack Query + Zustand was the correct architecture: one layer per concern.

**Decimal arithmetic is not optional for money** — Discovered early that floating-point rounding errors in tax + shipping calculations produced wrong invoice totals. Switched everything to `Decimal.js` and the problem disappeared. This is one of those things that seems like over-engineering until the accountant calls.

**Cron jobs are stateful infrastructure** — The overdue detection and low-stock snapshot jobs seem simple, but they need to be idempotent (safe to run twice), logged, and resilient to database errors. Treating them as throwaway `setInterval` calls would have created subtle data corruption bugs.

**Production Docker security requires explicit configuration** — The first version of `docker-compose.yml` used default passwords as fallbacks. Switched to hard-fail syntax (`:?error`) so the system refuses to start without explicit credentials. Default passwords in production are a silent vulnerability.

**Real-time streaming requires infrastructure-level changes** — The AI assistant worked perfectly in local development but produced no output in production until the Nginx response buffer was disabled. Debugging streaming requires understanding every layer between the API and the browser, not just the application code.

**RBAC has to live in middleware, not in controllers** — Initially some permission checks were scattered inside controllers. Centralizing them in a single `requireRole()` middleware meant the access control policy was auditable in one place and couldn't be accidentally bypassed by a new controller not checking permissions.

---

## License

Private — all rights reserved. Built by [Seif Osman](https://github.com/seifosmaan53).
