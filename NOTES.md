# Pizza Box System — Dev Notes

## Starting the App

### Start everything (recommended)
```
cd /Users/seifosman/pizza-box-system
docker-compose up
```

### Start manually
```
# Terminal 1 — Server
cd /Users/seifosman/pizza-box-system/server
npm run dev

# Terminal 2 — Client
cd /Users/seifosman/pizza-box-system/client
npm run dev
```

- Client runs at: http://localhost:5173
- Server runs at: http://localhost:3000

---

## Database (Prisma Studio)
Prisma Studio is a visual database browser — **dev only, not available in production**.

```
cd /Users/seifosman/pizza-box-system/server
npx prisma studio
```

Then open: http://localhost:5555

---

## Database Migrations
When you change the Prisma schema (`server/prisma/schema.prisma`), run:

```
cd /Users/seifosman/pizza-box-system/server
npx prisma migrate dev --name describe_your_change
npx prisma generate
```

---

## Seed Data (Sample / Demo Data)
The seed script fills the database with fake stores, inventory, invoices and users for testing.

**To run it:**
```
cd /Users/seifosman/pizza-box-system/server
npx prisma db seed
```

**WARNING:** Running the seed **wipes ALL existing data first**, then recreates the sample data.
- Deleted seed data does NOT come back on its own
- Only run this during development/testing — never on a live production database

---

## Default Login (after running seed)
| Role    | Email                  | Password     |
|---------|------------------------|--------------|
| Admin   | admin@company.com      | Admin123!    |
| Manager | manager@company.com    | Manager123!  |
| Viewer  | viewer@company.com     | Viewer123!   |

---

## Project Structure
```
pizza-box-system/
├── client/         # React frontend (Vite + TypeScript)
├── server/         # Express backend (Node + Prisma + PostgreSQL)
└── docker-compose.yml
```

## Key Files
| File | Purpose |
|------|---------|
| `client/src/types/index.ts` | All TypeScript types |
| `client/src/api/` | All API calls to the server |
| `server/src/controllers/` | All server business logic |
| `server/prisma/schema.prisma` | Database schema |
| `server/prisma/migrations/` | Database migration history |

---

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite, TanStack Query, Tailwind CSS
- **Backend:** Node.js, Express, Prisma ORM
- **Database:** PostgreSQL
- **Auth:** JWT tokens

---

## Currency
- USD (US Dollar) only — all stores and invoices use USD

---

## User Roles
| Role    | Can do |
|---------|--------|
| ADMIN   | Everything — users, settings, all data |
| MANAGER | Create/edit invoices, inventory, stores |
| VIEWER  | Read-only access |
