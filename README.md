# Nexus Platform

A full-stack startup platform for entrepreneurs and investors.

## Project structure

- `Nexus/` — React + TypeScript frontend built with Vite and Tailwind CSS.
- `server/` — Express + TypeScript backend API with MongoDB, Socket.IO, Stripe payment support, and Swagger documentation.

## Prerequisites

- Node.js 18+ / npm
- MongoDB connection string

## Setup

### Backend

1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Then update `.env` with your MongoDB URI and any required secrets.

### Frontend

1. Navigate to the frontend folder:
   ```bash
   cd Nexus
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the project

Start the backend API server:

```bash
cd server
npm run dev
```

Start the frontend development server:

```bash
cd Nexus
npm run dev
```

The frontend runs by default at `http://localhost:5173/`.

## Backend endpoints

- Health check: `GET /health`
- Swagger docs: `GET /api-docs`

## Notes

- The backend loads configuration from `server/.env`.
- Uploaded files are served from `/uploads`.
- If you need to use a local database, update `MONGODB_URI` in `server/.env`.
