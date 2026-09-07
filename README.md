# ReWear

A sustainable clothing exchange MVP. Users trade, donate, or rent garments using points held in escrow until delivery is confirmed.

## Run locally

1. Install Node.js 20+ and copy `backend/.env.example` to `backend/.env`.
2. Run `npm run setup` from the repository root. This installs dependencies, generates Prisma, creates the local database, and seeds 15 listings.
3. Run `npm run dev` and open `http://localhost:5173`.

The seeded user is `maya@rewear.local` / `password123`.

## Architecture

- `frontend/`: React + Vite interface styled with Tailwind utilities and custom CSS.
- `backend/`: Express REST API, JWT auth, Multer local image uploads, and Prisma persistence.
- `backend/prisma/schema.prisma`: models for users, items, transactions, reviews, and reports.

## Useful commands

- `npm run dev` — run frontend and backend together
- `npm run prisma:migrate -w backend -- --name your_change` — create a database migration
- `npm run seed -w backend` — seed sample data

Images are stored locally in `backend/uploads`. Swap Multer's storage layer for Cloudinary (or similar) later without changing item APIs.
