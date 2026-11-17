# AquaGalaxy

An aquarium/fish e-commerce platform: React (Vite) frontend + Express/MongoDB backend, Razorpay payments, Cloudinary media, RBAC-based admin dashboard.

See `documentation/MASTER_REPORT.md` for the full audit history, current status, environment variables, dependency notes, and deployment checklist. This file only covers running the project locally.

## Project structure

```
AquaGalaxy/
├── backend/        Express API (MongoDB via Mongoose)
├── frontend/       React 19 + Vite Web Application
├── mobile/         React Native (Expo SDK 58) Mobile App (Android/iOS)
└── documentation/
    └── MASTER_REPORT.md   Full audit + deployment report
```

## Backend — local setup

```bash
cd backend
npm install
cp .env.example .env   # fill in real values — see MASTER_REPORT.md §"Environment variables"
npm start               # or: node server.js
```

Requires a running MongoDB instance (`MONGO_URI`). Cloudinary credentials are required for any image/video upload to work; Razorpay, SMTP, WhatsApp, and Professional Courier credentials are optional in development — each integration no-ops gracefully when its credentials are unset (see the relevant sections of the master report).

Run the offline-runnable tests:
```bash
node tests/passwordReset.test.js   # pure-logic assertions run standalone
node tests/loginSecurity.test.js   # needs mongodb-memory-server (network access)
```

## Frontend — local setup

```bash
cd frontend
npm install
npm run dev      # local dev server, proxies API calls to http://localhost:5000
npm run build    # production build → dist/
```

The API base URL is set in `frontend/src/config.js` (supports `VITE_API_URL` or defaults to `http://localhost:5000` in dev).

## Mobile App (Expo / React Native) — local setup

```bash
cd mobile
npm install
npx expo start -c   # starts Metro bundler (scan QR code in Expo Go app)
```

The API base URL is set in `mobile/src/api/config.js` (supports `EXPO_PUBLIC_API_URL` or defaults to your live backend URL).
To build Android APKs:
```bash
cd mobile
eas build -p android --profile preview
```

## Deployment

Frontend is set up for Vercel (`frontend/vercel.json`, SPA rewrite + sitemap rewrite). Backend is environment-agnostic Express (currently referenced as deployed on Render in `config.js`/`vercel.json`, but nothing backend-side ties it to a specific host). See `documentation/MASTER_REPORT.md` for the full pre-deployment checklist, required environment variables per host, and known open items (mobile device testing, Cloudinary dependency upgrade, live payment/webhook testing) that should be completed before a production go-live.
