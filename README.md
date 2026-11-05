# Relief Dispatch

Emergency Relief Operations & Dispatch System, built for the RIT Dubai 16th Engineering Competition (Software Engineering, 2026–2027).

Relief Dispatch matches essential supplies in warehouses with urgent requests from shelters. It allocates stock by urgency and shelter priority, dispatches shipments to drivers, tracks every delivery, and reports what was fulfilled and what is still short.

## Team

- Indrajith Manoj
- Sourish Mukherjee
- Arnav Menon

Cambridge International School, Dubai

## Features

| Requirement | How Relief Dispatch meets it |
|---|---|
| Data models | Inventory, Requests, Shelters, Warehouses, Hospitals, On-call doctors, Shipments, Drivers, Users and logs in SQLite, managed by Knex migrations |
| Priority allocation engine | Urgency first (Critical > High > Moderate), then shelter priority, then oldest request |
| Inventory tracking | Stock is reserved as it is allocated and can never go below zero. Shortfalls are marked Partial or Unfulfilled |
| Nearest medical dispatch | A shelter medical request is matched to the nearest hospital that currently has an available doctor of that specialty (Euclidean distance). The doctor is marked Dispatched so they cannot be double-booked. If none are free, the ticket is Pending Medical Dispatch - High Urgency |
| User interface | React web portal with separate views for coordinator, shelter, warehouse and driver |
| Export and reporting | Fulfilled vs unfulfilled summary as PDF, CSV or JSON, plus a medical-dispatch CSV (Doctor ID, Specialty, Hospital Name, Travel Distance) |
| Automated testing | Jest + Supertest suite covering allocation, stock limits, permissions, delivery flows and medical dispatch |

Beyond the brief:

- **Role-based login** with JWT and bcrypt-hashed passwords. The server enforces what each role can do.
- **Automatic dispatch:** each allocation creates shipments and assigns the least-busy driver.
- **Delivery recovery:** damaged goods are written off and replaced at once, failed deliveries return stock and are re-sent, and shortfalls are filled automatically when a warehouse restocks.
- **Live map** of shelters and warehouses (Leaflet + OpenStreetMap). Sites can be placed by clicking the map or searching an address.
- **Stock history:** every warehouse stock change is logged with a reason.
- **Optional situation brief:** a plain-English summary of the operation. It uses Gemini if a key is set and falls back to a built-in summary if not. The app works fully without it.

## Tech stack

- **Backend:** Node.js, Express, Knex, SQLite
- **Frontend:** React, Vite, Leaflet, lucide-react
- **Auth:** JSON Web Tokens, bcryptjs
- **Testing:** Jest, Supertest

## Requirements

- Node.js 18 or newer
- npm

## Installation

```bash
git clone https://github.com/Iridiex/RITcomp.git
cd RITcomp
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx knex migrate:latest
npm run reset
npm run dev
```

CHECK: the backend runs at http://localhost:3001

The Gemini variables in `.env` are optional. Leave them blank to run without AI.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Demo accounts

| Role | Username | Password |
|---|---|---|
| Coordinator | coordinator | relief2026 |
| Shelter | sh01 – sh05 | shelter2026 |
| Warehouse | wh1 – wh2 | warehouse2026 |
| Driver | ahmed, priya, omar | driver2026 |

## Running the tests

```bash
cd backend
npm test
```

Tests run against a fresh in-memory database, so they never touch your real data.

## How allocation works

1. Waiting requests (Pending, Partial, Unfulfilled) are sorted by urgency, then shelter priority, then creation time.
2. Each request is filled from the warehouse with the most stock of that item first.
3. A request only takes what is left, so stock never goes negative.
4. Each request ends as Allocated, Partial or Unfulfilled.
5. Shipments are created and assigned to the least-busy driver.
6. The whole run happens in one database transaction: it all saves or none of it does.

A request becomes Fulfilled only when everything approved has been delivered.

## Request lifecycle

Awaiting review → Pending → Allocated / Partial / Unfulfilled → Fulfilled (or Rejected)

## Shipment lifecycle

Ready → In transit → Delivered (or Returned)

Damage at pickup or on arrival writes off the goods and dispatches a replacement.

## Medical dispatch

1. A shelter asks for a specialty and writes why. The coordinator reviews it. Logging it as coordinator skips review.
2. On approval, hospitals that currently have an **Available** doctor of that specialty are kept.
3. Distance is \(d=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}\) using each site's stored coordinates.
4. The nearest of those hospitals is chosen and its doctor is marked **Dispatched**.
5. If the nearest hospital has no matching doctor, the next-closest eligible hospital is used.
6. If none are free, the ticket is **Pending Medical Dispatch - High Urgency**. When the shelter marks the doctor arrived, that doctor is freed and the oldest waiting ticket of the same specialty is filled.

## Project structure