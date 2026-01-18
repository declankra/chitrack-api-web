# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js development server (port 3000)
npm run build    # Build for production
npm run lint     # Run ESLint
npm start        # Start production server
```

No test framework is configured.

## Architecture Overview

ChiTrack is a **Next.js 14** real-time Chicago CTA transit tracker serving both web frontend and API backend.

### Core Stack
- **Frontend**: Next.js App Router, React 18, React Query, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Next.js API Routes (serverless on Vercel)
- **Data**: Supabase (user data), Railway Redis (transit caching), CTA Train & Bus APIs
- **Maps**: Mapbox GL

### Directory Structure

```
src/
├── app/
│   ├── (app)/           # Main app pages (home, search, map, settings)
│   ├── (marketing)/     # Public pages (landing, blog, privacy)
│   └── api/             # Serverless endpoints
│       ├── cta/         # Train API routes
│       └── bus/         # Bus API routes
├── components/
│   ├── home/, map/, search/, settings/  # Feature components
│   ├── shared/          # NavigationDock, modals
│   └── ui/              # shadcn/ui components
└── lib/
    ├── bus/             # CTA Bus API client & normalizers
    ├── hooks/           # React Query hooks (useStationArrivals, useStopArrivals)
    ├── providers/       # Context providers (StationsProvider, TimeProvider)
    ├── types/           # TypeScript interfaces (cta.ts, user.ts)
    └── utilities/       # Helpers (timeUtils, findStop)
```

### Data Flow

1. **Client-side**: React Query hooks fetch from `/api/cta/*` or `/api/bus/*` with 15-second refetch intervals
2. **API layer**: Validates params, checks Redis cache, calls external CTA API on cache miss
3. **Caching**: Station metadata cached 7 days; arrivals cached 15 seconds

### Key Patterns

- **Station vs Stop IDs**: Stations are 4xxxx (parent), Stops are 3xxxx (platform/direction)
- **Client components**: Use `'use client'` directive; dynamic imports with `ssr: false` for browser-only features
- **API responses**: Bus API uses `BusApiSuccess<T>` / `BusApiError` wrapper types
- **Route colors**: Defined in `ROUTE_COLORS` constant in `src/lib/types/cta.ts`

### iPhone Mockup Container

The app renders inside a fixed 390×844px container mimicking iOS. The NavigationDock is positioned absolutely at the bottom.

## Environment Variables

Copy `.env.example` to `.env.local`:
- `CTA_TRAIN_API_KEY` – CTA Train Tracker API key
- `CTA_BUS_TRACKER_API_KEY` – CTA Bus Tracker v3 API key (server-only)
- Supabase, Redis, Mapbox, and analytics credentials per example file

## Development Guidelines

Execute requests **exactly as specified** - no scope creep or unrequested features. Simplest solution that fulfills requirements with minimal lines of code.
