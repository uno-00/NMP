# NMP Technical Assistance Request System

Three-portal system for the National Museum of the Philippines technical assistance workflow.

## Portals

| Portal | URL | Role | Purpose |
|--------|-----|------|---------|
| **Admin** | http://on-prem.x-dcb.net:5173/admin | admin | Build and publish request forms |
| **Client** | http://on-prem.x-dcb.net:5173/client | user | Submit requests with uploaded documents |
| **Records** | http://on-prem.x-dcb.net:5173/records | record_management | Review submissions, set recommendation |

## Flow

1. **Admin** builds a form and clicks **Save & publish** → form goes live.
2. **Client** signs in, fills the live form, uploads a PDF → submission goes to Records as **For Review**.
3. **Record Admin** sees pending count in the notification bell, reviews the uploaded file, selects a **Recommendation**, and clicks **Submit**.

## Quick start

```bash
bun run setup
bun run start
```

Requires MongoDB running locally and [Bun](https://bun.sh).

## Seed accounts

| Email | Password | Portal |
|-------|----------|--------|
| admin@nmp.gov.ph | admin123 | Admin |
| user@nmp.gov.ph | user123 | Client |
| records@nmp.gov.ph | records123 | Records |

## Build

```bash
cd backend && bun run build
cd frontend && bun run build
```
