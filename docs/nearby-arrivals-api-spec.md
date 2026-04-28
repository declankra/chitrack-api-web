# Spec: Backend API for "Nearby Arrivals" Map (React Native client)

## Context

A separate React Native app needs to render a map showing the user's nearby
CTA train stations and bus stops along with live arrival times. The
existing API in this repo is built around explicit IDs (you must already know
a `mapid`/`stpid`); there is no geo lookup, no combined train+bus endpoint, and
the GTFS parser silently discards bus stops. This spec adds the minimum
backend surface required for the RN app to do "show me arrivals near here"
in a single round-trip while reusing existing arrival endpoints for refresh.

Decisions:
- Bundle arrivals for the top ~5 closest of each mode in the nearby response
- Keep endpoints public (matches existing `/api/cta/*` and `/api/bus/*`)
- Source bus-stop catalog by extending the GTFS parser, cache in-memory 24h

## What's being added

1. A geo distance utility (haversine + bbox prefilter)
2. Bus-stop extraction from the GTFS feed (already downloaded for trains)
3. A 24h in-memory cache for the parsed station/stop catalogs (shared by trains and buses)
4. A new `GET /api/nearby` endpoint returning nearby train stations and bus stops, with arrivals bundled for the top N closest of each
5. Type definitions for the new response shape, mirroring the existing bus `{ data, error, meta }` envelope
6. CORS headers permissive enough for the RN app's dev tooling (Expo web, etc.)

No new auth, no rate limiting, no new dependencies (haversine is ~10 lines).

## Files

### New

- `src/lib/utilities/geo.ts`
  - `haversineMeters(a: LatLng, b: LatLng): number`
  - `boundingBox(center: LatLng, radiusMeters: number): { minLat, maxLat, minLng, maxLng }` — coarse prefilter so we don't run haversine over 12k bus stops
  - `LatLng` type

- `src/lib/gtfs/catalog.ts`
  - `getCatalog(): Promise<{ trainStations: Station[]; busStops: BusStopCatalogEntry[]; fetchedAt: string }>`
  - Module-level Promise + timestamp cache (24h TTL); first call after cold start downloads + parses GTFS, subsequent calls return cached
  - Reuses the existing GTFS download flow from `src/lib/gtfs/index.ts` but extracts both `location_type=1` (train parents) AND `location_type=0` rows with no `parent_station` (bus stops)
  - Wraps the existing `transformStops` logic; adds a parallel `transformBusStops` pass
  - `BusStopCatalogEntry`: `{ id, name, lat, lng, directionLabel?: string }` — note: GTFS bus stops do not list which routes serve them. Routes are inferred at request time from the existing predictions response (or omitted in v1; see "Out of scope")

- `src/app/api/nearby/route.ts`
  - `GET /api/nearby?lat=&lng=&radius=&mode=&limit=&includeArrivals=`
  - Params:
    - `lat`, `lng` (required, validated as Chicago-ish bounds: 41.6–42.1, -88.0–-87.5; reject otherwise)
    - `radius` meters, default 800, max 3000
    - `mode` `all | train | bus`, default `all`
    - `limit` per-mode max, default 10, max 25
    - `includeArrivals` boolean, default `true`; when true, fetches arrivals for the top 5 closest of each mode in parallel
  - Flow:
    1. Validate params
    2. `await getCatalog()`
    3. Bbox prefilter, then haversine, then sort by distance, then truncate to `limit`
    4. If `includeArrivals`: parallel fan-out
       - Train: chunk top-5 station IDs into groups of 4 (CTA mapids cap), call existing internal helper extracted from `src/app/api/cta/arrivals/station/route.ts`
       - Bus: collect top-5 bus stop IDs, call existing internal helper extracted from `src/app/api/bus/predictions/route.ts`
    5. Merge arrivals back onto the nearby items by ID
  - Response envelope identical to bus API: `{ data, error, meta }` with `meta.queriedAt`, `meta.servedFromCache`, `meta.catalogFetchedAt`

- `src/lib/nearby/arrivalsFanOut.ts`
  - Extract the train-arrival fetch + filter logic from `src/app/api/cta/arrivals/station/route.ts` (`processArrivals`, `parseArrivalTime`, `isRelevantArrival`, `fetchCtaApiWithRetry`) into a reusable function: `fetchTrainArrivalsForStations(stationIds: string[])`
  - Extract the bus prediction fetch from `src/app/api/bus/predictions/route.ts` into `fetchBusPredictionsForStops(stopIds: string[])`
  - Both functions reuse caching that already exists in their respective handlers

### Modified

- `src/lib/gtfs/index.ts`
  - Export the GTFS download + parse separately so the new catalog can call the same download once and produce two outputs (avoid double-downloading)
  - Keep `fetchGtfsStations()` as-is (back-compat)

- `src/app/api/cta/stations/route.ts`
  - Switch from `fetchGtfsStations()` direct call to `getCatalog().then(c => c.trainStations)` — gets it the 24h cache for free, fixes the current "fetch GTFS on every request" footgun
  - Keep `force-dynamic` at handler level; caching is in the catalog layer

- `src/app/api/cta/arrivals/station/route.ts` and `src/app/api/bus/predictions/route.ts`
  - Refactor: route handler becomes a thin wrapper over the new `arrivalsFanOut.ts` functions. No behavior change; just makes the helpers reusable from `/api/nearby`.

- `src/lib/types/cta.ts`
  - Add:
    ```ts
    export interface NearbyTrainStation {
      stationId: string;
      stationName: string;
      lat: number;
      lng: number;
      distanceMeters: number;
      stops: StationStop[];
      arrivals?: Arrival[]; // present when includeArrivals=true and within top-N
    }
    export interface NearbyBusStop {
      stopId: string;
      stopName: string;
      lat: number;
      lng: number;
      distanceMeters: number;
      predictions?: BusPrediction[]; // present when includeArrivals=true and within top-N
    }
    export interface NearbyResponseData {
      trainStations: NearbyTrainStation[];
      busStops: NearbyBusStop[];
      origin: { lat: number; lng: number; radiusMeters: number };
    }
    ```

- `next.config.js` (or create `src/middleware.ts`)
  - Add CORS headers on `/api/*`: `Access-Control-Allow-Origin: *`, `Allow-Methods: GET, OPTIONS`, `Allow-Headers: Content-Type`. RN itself doesn't enforce CORS, but this lets the RN team test from Expo web during development without proxying.

## Reused from existing code

- GTFS download/unzip/parse: `src/lib/gtfs/index.ts` (split, then reused)
- Train arrival filtering and CTA API retry: `processArrivals`, `parseArrivalTime`, `isRelevantArrival`, `fetchCtaApiWithRetry` in `src/app/api/cta/arrivals/station/route.ts`
- Bus prediction fetch + cache: `src/lib/bus/ctaBusClient.ts` (call via the extracted `fetchBusPredictionsForStops`)
- Bus API envelope shape: `BusApiSuccess<T> | BusApiError` and `BusApiMeta` from `src/lib/types/cta.ts`
- Station/StationStop/Arrival/BusStop/BusPrediction types in `src/lib/types/cta.ts`

## Out of scope (open follow-ups)

- **Mapping bus stops → serving routes.** GTFS `stops.txt` doesn't list routes; that lives in `trips.txt` + `stop_times.txt` (much larger files). v1 returns bus stops with predictions only — the predictions themselves carry `routeId`, which is enough for the RN client to render colored pins. If the RN team needs routes *before* predictions arrive (e.g., for filtering), follow up with a `routesByStopId` lookup table built from `stop_times.txt` at GTFS parse time.
- Auth, rate limiting, API versioning under `/api/v1/*`
- Pagination for nearby results beyond the top 25
- Persisting the parsed catalog to disk/Redis for cold-start performance — only matters if Vercel cold-start parse time (~5–10s for first request) becomes a problem

## Verification

End-to-end, after implementation:

1. **Catalog parse**
   - `npm run dev`, then `curl 'http://localhost:3000/api/cta/stations'` — expect ~145 train stations as before. First call may be slow (~5–10s for GTFS download); second call should be instant (cache hit).

2. **Nearby, train+bus, with arrivals** (Loop coordinates)
   - `curl 'http://localhost:3000/api/nearby?lat=41.8827&lng=-87.6233&radius=800&includeArrivals=true' | jq`
   - Expect: `data.trainStations[].stationName` to include "Clark/Lake", "State/Lake", etc.; first 5 entries to have non-empty `arrivals` arrays; `data.busStops[]` to be non-empty with `predictions` on the top 5; all `distanceMeters` ascending.

3. **Mode filter**
   - `curl '...&mode=train'` — `busStops` should be empty array; `trainStations` populated.
   - `curl '...&mode=bus'` — inverse.

4. **Bounds rejection**
   - `curl '...?lat=37.7&lng=-122.4'` — expect 400 with error code `LAT_LNG_OUT_OF_BOUNDS`.

5. **Cache behavior**
   - Two consecutive requests within 5s: second should show `meta.servedFromCache: true` for the catalog (arrivals are not cached at the nearby layer; they inherit existing TTLs).

6. **Envelope parity**
   - Response shape: `{ data, error: null, meta: { queriedAt, ctaEndpoint: 'nearby', paramsUsed, status: 200, ... } }`. Validates parity with the bus API the RN client likely already understands.

7. **CORS**
   - `curl -i -H 'Origin: http://localhost:8081' 'http://localhost:3000/api/nearby?...'` — expect `Access-Control-Allow-Origin: *` in response headers.

8. **Type-check + lint**
   - `npm run lint` and `npx tsc --noEmit` clean.

9. **Web app smoke**
   - Load the existing web map (`/map`) — must still work because `/api/cta/stations` was only refactored to share the new catalog cache; behavior is unchanged.
