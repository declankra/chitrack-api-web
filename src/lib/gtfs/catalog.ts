import {
  cleanupGtfsTempFile,
  downloadGtfsFile,
  parseStops,
  transformStops,
} from "@/lib/gtfs";
import { BusStopCatalogEntry, Station } from "@/lib/types/cta";

const TTL_MS = 24 * 60 * 60 * 1000;

export interface Catalog {
  trainStations: Station[];
  busStops: BusStopCatalogEntry[];
  fetchedAt: string;
}

let cachedCatalog: Catalog | null = null;
let cachedAt = 0;
let inFlight: Promise<Catalog> | null = null;

async function buildCatalog(): Promise<Catalog> {
  await downloadGtfsFile();
  try {
    const rows = await parseStops();
    const trainStations = transformStops(rows);
    const busStops: BusStopCatalogEntry[] = [];
    for (const row of rows) {
      if (row.location_type === "0" && !row.parent_station) {
        const lat = parseFloat(row.stop_lat);
        const lng = parseFloat(row.stop_lon);
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
        busStops.push({
          id: row.stop_id,
          name: row.stop_name,
          lat,
          lng,
          directionLabel: row.direction || row.stop_desc || undefined,
        });
      }
    }
    return {
      trainStations,
      busStops,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await cleanupGtfsTempFile();
  }
}

export async function getCatalog(): Promise<Catalog> {
  if (cachedCatalog && Date.now() - cachedAt < TTL_MS) {
    return cachedCatalog;
  }
  if (inFlight) return inFlight;
  inFlight = buildCatalog()
    .then((catalog) => {
      cachedCatalog = catalog;
      cachedAt = Date.now();
      return catalog;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function isCatalogCached(): boolean {
  return cachedCatalog !== null && Date.now() - cachedAt < TTL_MS;
}
