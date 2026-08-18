# Rhisos Mobilya CRM — PRD

## Problem Statement
Rhisos Mobilya (a Turkish furniture company) needs a CRM to create quotes/offers and track incoming/outgoing money.

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT auth via httpOnly cookies (access+refresh), bcrypt password hashing, brute-force lockout, admin seeding.
- Frontend: React 19, react-router, TailwindCSS, shadcn/ui, Recharts, sonner. AuthContext + protected routes.
- Language: Turkish UI, ₺ primary currency (USD/EUR supported per quote/transaction).

## User Personas
- Owner/Admin (iskberkan@gmail.com): manages quotes, customers, cash flow, views dashboard.
- Staff users: register + use the same CRM (single-org, shared data).

## Core Requirements (static)
- Email+password auth.
- Quotes: customer, line items (qty/unit price/KDV), discount, totals, status (pending/approved/rejected), PDF/print.
- Cash flow: income/expense with category, payment method, date, currency; filters; summary.
- Approved quote auto-creates linked income; revert/delete removes it.
- Dashboard with charts (monthly income/expense bar, expense category pie) + KPIs.

## Implemented (2026-08-18)
- Full JWT auth (register/login/logout/me/refresh), admin seeded.
- Customers CRUD.
- Quotes CRUD + status change + auto-income linkage + browser print/PDF.
- Transactions CRUD + type/date filters + summary cards.
- Dashboard stats endpoint + charts.
- Earthy/organic furniture-brand design system.
- Tested: backend 21/21 pytest pass, frontend E2E 100%.

## Backlog / Remaining
- P1: MongoDB aggregation for dashboard (currently in-Python).
- P2: Per-user data scoping (multi-tenant) if needed.
- P2: Server-side PDF generation, email quote to customer.
- P2: Quote number race-safety (atomic counter).

## Next Tasks
- Await user feedback on first version.
