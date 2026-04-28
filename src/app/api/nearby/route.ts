import { NextRequest, NextResponse } from "next/server";
import { getCatalog, isCatalogCached } from "@/lib/gtfs/catalog";
import { boundingBox, haversineMeters, type LatLng } from "@/lib/utilities/geo";
import {
  fetchBusPredictionsForStops,
  fetchTrainArrivalsForStations,
} from "@/lib/nearby/arrivalsFanOut";
import {
  Arrival,
  BusApiError,
  BusApiMeta,
  BusApiSuccess,
  BusPrediction,
  NearbyBusStop,
  NearbyResponseData,
  NearbyTrainStation,
  Station,
  StationArrivalsResponse,
} from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "nearby";
const DEFAULT_RADIUS = 800;
const MAX_RADIUS = 3000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const ARRIVALS_FAN_OUT = 5;
const CHICAGO_BOUNDS = { minLat: 41.6, maxLat: 42.1, minLng: -88.0, maxLng: -87.5 };

type Mode = "all" | "train" | "bus";

interface ParsedParams {
  origin: LatLng;
  radius: number;
  mode: Mode;
  limit: number;
  includeArrivals: boolean;
}

const parseBoolean = (value: string | null, fallback: boolean): boolean => {
  if (value === null) return fallback;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
};

const clampInt = (raw: string | null, fallback: number, max: number): number => {
  if (raw === null) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.min(n, max);
};

const isInChicago = ({ lat, lng }: LatLng): boolean =>
  lat >= CHICAGO_BOUNDS.minLat &&
  lat <= CHICAGO_BOUNDS.maxLat &&
  lng >= CHICAGO_BOUNDS.minLng &&
  lng <= CHICAGO_BOUNDS.maxLng;

const buildMeta = (
  paramsUsed: Record<string, string | number>,
  status: number,
  servedFromCache: boolean,
  catalogFetchedAt?: string,
  reason?: string
): BusApiMeta & { catalogFetchedAt?: string } => ({
  queriedAt: new Date().toISOString(),
  ctaEndpoint: ENDPOINT,
  paramsUsed,
  status,
  servedFromCache,
  reason,
  catalogFetchedAt,
});

const errorResponse = (
  code: string,
  message: string,
  status: number,
  paramsUsed: Record<string, string | number>
): BusApiError => ({
  data: null,
  error: { code, message },
  meta: buildMeta(paramsUsed, status, false),
});

const collectTrainArrivals = (
  results: StationArrivalsResponse[]
): Map<string, Arrival[]> => {
  const map = new Map<string, Arrival[]>();
  for (const station of results) {
    const arrivals: Arrival[] = [];
    for (const stop of station.stops) {
      arrivals.push(...stop.arrivals);
    }
    map.set(station.stationId, arrivals);
  }
  return map;
};

const collectBusPredictions = (predictions: BusPrediction[]): Map<string, BusPrediction[]> => {
  const map = new Map<string, BusPrediction[]>();
  for (const prediction of predictions) {
    const list = map.get(prediction.stopId) ?? [];
    list.push(prediction);
    map.set(prediction.stopId, list);
  }
  return map;
};

const filterTrainStations = (
  stations: Station[],
  origin: LatLng,
  radius: number,
  limit: number
): NearbyTrainStation[] => {
  const bbox = boundingBox(origin, radius);
  const matches: NearbyTrainStation[] = [];
  for (const station of stations) {
    if (typeof station.lat !== "number" || typeof station.lon !== "number") continue;
    if (
      station.lat < bbox.minLat ||
      station.lat > bbox.maxLat ||
      station.lon < bbox.minLng ||
      station.lon > bbox.maxLng
    ) {
      continue;
    }
    const distanceMeters = haversineMeters(origin, { lat: station.lat, lng: station.lon });
    if (distanceMeters > radius) continue;
    matches.push({
      stationId: station.stationId,
      stationName: station.stationName,
      lat: station.lat,
      lng: station.lon,
      distanceMeters,
      stops: station.stops,
    });
  }
  matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return matches.slice(0, limit);
};

const filterBusStops = (
  stops: import("@/lib/types/cta").BusStopCatalogEntry[],
  origin: LatLng,
  radius: number,
  limit: number
): NearbyBusStop[] => {
  const bbox = boundingBox(origin, radius);
  const matches: NearbyBusStop[] = [];
  for (const stop of stops) {
    if (
      stop.lat < bbox.minLat ||
      stop.lat > bbox.maxLat ||
      stop.lng < bbox.minLng ||
      stop.lng > bbox.maxLng
    ) {
      continue;
    }
    const distanceMeters = haversineMeters(origin, { lat: stop.lat, lng: stop.lng });
    if (distanceMeters > radius) continue;
    matches.push({
      stopId: stop.id,
      stopName: stop.name,
      lat: stop.lat,
      lng: stop.lng,
      distanceMeters,
    });
  }
  matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return matches.slice(0, limit);
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");

  const params: ParsedParams = {
    origin: { lat: parseFloat(latRaw ?? ""), lng: parseFloat(lngRaw ?? "") },
    radius: clampInt(searchParams.get("radius"), DEFAULT_RADIUS, MAX_RADIUS),
    mode: (searchParams.get("mode") as Mode) || "all",
    limit: clampInt(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT),
    includeArrivals: parseBoolean(searchParams.get("includeArrivals"), true),
  };

  const paramsUsed: Record<string, string | number> = {
    lat: latRaw ?? "",
    lng: lngRaw ?? "",
    radius: params.radius,
    mode: params.mode,
    limit: params.limit,
    includeArrivals: String(params.includeArrivals),
  };

  if (Number.isNaN(params.origin.lat) || Number.isNaN(params.origin.lng)) {
    return NextResponse.json(
      errorResponse("LAT_LNG_REQUIRED", "Both lat and lng query parameters are required.", 400, paramsUsed),
      { status: 400 }
    );
  }

  if (!isInChicago(params.origin)) {
    return NextResponse.json(
      errorResponse(
        "LAT_LNG_OUT_OF_BOUNDS",
        "lat/lng must be within the Chicago region (41.6–42.1, -88.0–-87.5).",
        400,
        paramsUsed
      ),
      { status: 400 }
    );
  }

  if (params.mode !== "all" && params.mode !== "train" && params.mode !== "bus") {
    return NextResponse.json(
      errorResponse("INVALID_MODE", "mode must be one of: all, train, bus.", 400, paramsUsed),
      { status: 400 }
    );
  }

  try {
    const catalogServedFromCache = isCatalogCached();
    const catalog = await getCatalog();

    const trainStations =
      params.mode === "bus"
        ? []
        : filterTrainStations(catalog.trainStations, params.origin, params.radius, params.limit);
    const busStops =
      params.mode === "train"
        ? []
        : filterBusStops(catalog.busStops, params.origin, params.radius, params.limit);

    if (params.includeArrivals) {
      const trainTargets = trainStations.slice(0, ARRIVALS_FAN_OUT).map((s) => s.stationId);
      const busTargets = busStops.slice(0, ARRIVALS_FAN_OUT).map((s) => s.stopId);

      const [trainResults, busResults] = await Promise.all([
        trainTargets.length > 0
          ? fetchTrainArrivalsForStations(trainTargets).catch((error) => {
              console.error("Nearby: train arrivals fan-out failed:", error);
              return [] as StationArrivalsResponse[];
            })
          : Promise.resolve([] as StationArrivalsResponse[]),
        busTargets.length > 0
          ? fetchBusPredictionsForStops(busTargets).catch((error) => {
              console.error("Nearby: bus predictions fan-out failed:", error);
              return [] as BusPrediction[];
            })
          : Promise.resolve([] as BusPrediction[]),
      ]);

      const trainMap = collectTrainArrivals(trainResults);
      const busMap = collectBusPredictions(busResults);

      for (let i = 0; i < Math.min(ARRIVALS_FAN_OUT, trainStations.length); i++) {
        trainStations[i].arrivals = trainMap.get(trainStations[i].stationId) ?? [];
      }
      for (let i = 0; i < Math.min(ARRIVALS_FAN_OUT, busStops.length); i++) {
        busStops[i].predictions = busMap.get(busStops[i].stopId) ?? [];
      }
    }

    const data: NearbyResponseData = {
      trainStations,
      busStops,
      origin: { lat: params.origin.lat, lng: params.origin.lng, radiusMeters: params.radius },
    };

    const success: BusApiSuccess<NearbyResponseData> = {
      data,
      error: null,
      meta: buildMeta(paramsUsed, 200, catalogServedFromCache, catalog.fetchedAt),
    };
    return NextResponse.json(success);
  } catch (error) {
    console.error("Error in nearby API route:", error);
    return NextResponse.json(
      errorResponse(
        "NEARBY_INTERNAL_ERROR",
        error instanceof Error ? error.message : "Unexpected error.",
        500,
        paramsUsed
      ),
      { status: 500 }
    );
  }
}
