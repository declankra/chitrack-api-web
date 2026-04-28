import {
  Arrival,
  ArrivalsApiResponse,
  BusPrediction,
  StationArrivalsResponse,
} from "@/lib/types/cta";
import { callBusApi, type BusApiClientResult } from "@/lib/bus/ctaBusClient";
import { normalizePredictions, type PredictionsPayload } from "@/lib/bus/normalizers";

const CTA_API_KEY = process.env.CTA_TRAIN_API_KEY;
const CTA_API_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;
const MAX_PAST_MINUTES = 2;
const TIME_OFFSET_MS = 5000;
const CTA_MAPID_CHUNK = 4;
const BUS_PREDICTIONS_TTL_MS = 15_000;

export function parseArrivalTime(ctaTime: string): number {
  try {
    if (ctaTime.includes("T")) {
      const date = new Date(ctaTime);
      if (!isNaN(date.getTime())) return date.getTime();
    }
    const [datePart, timePart] = ctaTime.split(" ");
    if (!datePart || !timePart) return Infinity;
    const year = +datePart.slice(0, 4);
    const month = +datePart.slice(4, 6) - 1;
    const day = +datePart.slice(6, 8);
    const [hour, minute, second] = timePart.split(":").map((x) => +x);
    const parsed = new Date(year, month, day, hour, minute, second);
    if (Number.isNaN(parsed.getTime())) return Infinity;
    return parsed.getTime();
  } catch (error) {
    console.error("Error parsing CTA date:", error);
    return Infinity;
  }
}

export function isRelevantArrival(arrivalTime: string): boolean {
  const timestamp = parseArrivalTime(arrivalTime);
  if (timestamp === Infinity) return true;
  const diffMinutes = (timestamp - (Date.now() + TIME_OFFSET_MS)) / 60000;
  return diffMinutes > -MAX_PAST_MINUTES;
}

export async function fetchCtaApiWithRetry(url: string, retryCount = 0): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CTA_API_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeoutId);
    if (!response.ok) {
      if (retryCount < MAX_RETRIES) {
        return fetchCtaApiWithRetry(url, retryCount + 1);
      }
      throw new Error(
        "It looks like we couldn't fetch live data, which can happen if your internet connection was temporarily lost. Please check your connection and try again."
      );
    }
    return response;
  } catch (error: any) {
    if (
      retryCount < MAX_RETRIES &&
      (error.name === "AbortError" || error.name === "TypeError" || error.message?.includes("network"))
    ) {
      return fetchCtaApiWithRetry(url, retryCount + 1);
    }
    throw error;
  }
}

export function processArrivals(rawArrivals: Arrival[]): StationArrivalsResponse[] {
  const relevant = rawArrivals.filter((arr) => isRelevantArrival(arr.arrT));
  const arrivals = relevant.length > 0 ? relevant : rawArrivals;

  const stationMap: Record<
    string,
    {
      stationId: string;
      stationName: string;
      stops: Record<
        string,
        { stopId: string; stopName: string; route: string; arrivals: Arrival[] }
      >;
    }
  > = {};

  for (const arrival of arrivals) {
    if (!stationMap[arrival.staId]) {
      stationMap[arrival.staId] = {
        stationId: arrival.staId,
        stationName: arrival.staNm,
        stops: {},
      };
    }
    if (!stationMap[arrival.staId].stops[arrival.stpId]) {
      stationMap[arrival.staId].stops[arrival.stpId] = {
        stopId: arrival.stpId,
        stopName: arrival.stpDe,
        route: arrival.rt,
        arrivals: [],
      };
    }
    stationMap[arrival.staId].stops[arrival.stpId].arrivals.push(arrival);
  }

  return Object.values(stationMap).map((station) => ({
    stationId: station.stationId,
    stationName: station.stationName,
    stops: Object.values(station.stops).map((stop) => {
      stop.arrivals.sort((a, b) => parseArrivalTime(a.arrT) - parseArrivalTime(b.arrT));
      return stop;
    }),
  }));
}

async function fetchTrainArrivalsChunk(stationIds: string[]): Promise<StationArrivalsResponse[]> {
  if (!CTA_API_KEY) {
    throw new Error("CTA API key not configured.");
  }
  const url = `https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx?key=${CTA_API_KEY}&mapid=${stationIds.join(",")}&outputType=JSON`;
  try {
    const response = await fetchCtaApiWithRetry(url);
    const raw: ArrivalsApiResponse = await response.json();
    if (raw.ctatt.errCd !== "0") {
      console.error("CTA API Error:", raw.ctatt.errNm, "(Code:", raw.ctatt.errCd, ")");
      return [];
    }
    return processArrivals(raw.ctatt.eta || []);
  } catch (error) {
    console.error(`Failed to fetch CTA data for stations ${stationIds.join(",")}:`, error);
    return [];
  }
}

export async function fetchTrainArrivalsForStations(
  stationIds: string[]
): Promise<StationArrivalsResponse[]> {
  if (stationIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < stationIds.length; i += CTA_MAPID_CHUNK) {
    chunks.push(stationIds.slice(i, i + CTA_MAPID_CHUNK));
  }
  const results = await Promise.all(chunks.map(fetchTrainArrivalsChunk));
  return results.flat();
}

export interface BusPredictionsExtras {
  routeId?: string;
  vehicleId?: string;
  top?: string;
}

const BUS_PREDICTIONS_ENDPOINT = "getpredictions";

export function buildBusPredictionsCacheKey(stpidParam: string, extras: BusPredictionsExtras = {}): string {
  return `bus:${BUS_PREDICTIONS_ENDPOINT}:${stpidParam}:${extras.routeId ?? ""}:${extras.vehicleId ?? ""}:${extras.top ?? ""}`;
}

export async function callBusPredictions(
  stopIds: string[],
  extras: BusPredictionsExtras = {}
): Promise<BusApiClientResult<PredictionsPayload>> {
  const stpidParam = stopIds.join(",");
  const cacheTtlMs = extras.top || extras.vehicleId ? 0 : BUS_PREDICTIONS_TTL_MS;
  return callBusApi<PredictionsPayload>({
    endpoint: BUS_PREDICTIONS_ENDPOINT,
    params: {
      stpid: stpidParam,
      rt: extras.routeId,
      top: extras.top,
      vid: extras.vehicleId,
    },
    requiredParams: ["stpid"],
    cacheKey: buildBusPredictionsCacheKey(stpidParam, extras),
    cacheTtlMs,
  });
}

export async function fetchBusPredictionsForStops(stopIds: string[]): Promise<BusPrediction[]> {
  if (stopIds.length === 0) return [];
  const result = await callBusPredictions(stopIds);
  return normalizePredictions(result.payload);
}
