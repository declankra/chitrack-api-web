/**
 * src/lib/gtfs/index.ts
 *
 * This file handles downloading the CTA GTFS feed and transforming the stops.txt data
 * into our application's Station and StationStop structures.
 *
 * We differentiate 'station' (location_type=1, ID=4xxxx) from 'stop' (location_type=0, ID=3xxxx).
 * The 'parent_station' of a stop references the station's ID.
 *
 * Example GTFS rows:
 *  - location_type=1 => row describes a station
 *  - location_type=0 => row describes a platform or stop
 */

import fetch from 'node-fetch';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { type File } from 'unzipper';
import * as unzipper from 'unzipper';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { Station, StationStop } from '@/lib/types/cta';

const GTFS_TEMP_PATH = '/tmp/cta_gtfs.zip';  // Where we temporarily store the downloaded zip
const GTFS_URL = 'https://www.transitchicago.com/downloads/sch_data/google_transit.zip';

/**
 * A minimal interface to represent a single row from stops.txt (GTFS).
 */
interface GtfsStop {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  stop_desc: string; // CTA often puts 'Service toward X' here
  stop_lat: string;
  stop_lon: string;
  zone_id: string;
  stop_url: string;
  location_type: string;
  parent_station: string;
  stop_timezone: string;
  wheelchair_boarding: string;
  direction: string; // CTA sometimes includes a direction letter (N, S, E, W)
}

/**
 * Downloads the CTA GTFS zip file from the official CTA resource URL.
 * Stores it at GTFS_TEMP_PATH for processing.
 */
export async function downloadGtfsFile(): Promise<void> {
  const response = await fetch(GTFS_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download GTFS file: ${response.statusText}`);
  }

  const fileStream = createWriteStream(GTFS_TEMP_PATH);
  await new Promise<void>((resolve, reject) => {
    const body = response.body as unknown as Readable;
    body.pipe(fileStream);
    body.on('error', reject);
    fileStream.on('finish', resolve);
  });
}

/**
 * Reads the stops.txt file from the downloaded GTFS zip file,
 * then parses it as CSV, returning an array of GtfsStop objects.
 */
export async function parseStops(): Promise<GtfsStop[]> {
  const stops: GtfsStop[] = [];

  // Use unzipper to open the GTFS zip archive
  const directory = await unzipper.Open.file(GTFS_TEMP_PATH);
  const stopsFile = directory.files.find((f: File) => f.path === 'stops.txt');
  if (!stopsFile) {
    throw new Error('stops.txt not found in GTFS file');
  }

  // Extract the file content and parse it as CSV
  const content = await stopsFile.buffer();
  const parser = parse(content, {
    columns: true,
    skip_empty_lines: true,
  });

  for await (const record of parser) {
    stops.push(record as GtfsStop);
  }

  return stops;
}

/**
 * Convert the raw GTFS stops into our custom Station[] array.
 * - Stations (location_type=1) become top-level Station items.
 * - Stops (location_type=0) get nested into their parent station's 'stops' array.
 *
 * Fields:
 * - stationId => stop_id for station (4xxxx)
 * - stationName => stop_name for station
 * - lat/lon => numeric conversions from stop_lat/stop_lon
 * - stops[] => array of StationStop, each with:
 *     - stopId (3xxxx)
 *     - stopName => stop_name from GTFS
 *     - stopDesc => stop_desc from GTFS (e.g. "Service toward Loop")
 *     - directionName => direction from the GTFS row, or fallback to stop_desc
 *     - parentStationId => parent's stationId
 *     - lat, lon => numeric
 *     - wheelchairBoarding => "0", "1", or "2" from GTFS to indicate accessibility
 */
export function transformStops(gtfsStops: GtfsStop[]): Station[] {
  const stationMap = new Map<string, Station>();

  // 1) Create Station entries for each row with location_type=1
  //    The "stop_id" is the 4xxxx station ID.
  gtfsStops.forEach((stop) => {
    if (stop.location_type === '1') {
      stationMap.set(stop.stop_id, {
        stationId: stop.stop_id,
        stationName: stop.stop_name,
        lat: parseFloat(stop.stop_lat),
        lon: parseFloat(stop.stop_lon),
        stops: [],
      });
    }
  });

  // 2) For each row with location_type=0, it belongs to a parent station (4xxxx).
  //    We'll push it into that station's 'stops' array.
  gtfsStops.forEach((stop) => {
    if (stop.location_type === '0' && stop.parent_station) {
      const station = stationMap.get(stop.parent_station);
      if (!station) {
        // If we don't find a parent station, data might be incomplete or
        // maybe it's a weird case for the CTA feed. Just skip for now.
        // Add a log for skipped stops for debugging
        console.warn(`GTFS Transform: Stop ${stop.stop_id} has parent_station ${stop.parent_station}, but parent station not found in map.`);
        return;
      }

      const latNum = parseFloat(stop.stop_lat);
      const lonNum = parseFloat(stop.stop_lon);

      // For 'directionName', we can prefer the explicit 'direction' field if present,
      // else fallback to stop_desc, else "N/A"
      const directionNameCandidate = stop.direction || stop.stop_desc || 'N/A';

      const stationStop: StationStop = {
        stopId: stop.stop_id,
        stopName: stop.stop_name,  // ex: "Southport" or "Clark/Lake"
        stopDesc: stop.stop_desc,
        directionName: directionNameCandidate,
        parentStationId: stop.parent_station,
        lat: Number.isNaN(latNum) ? 0 : latNum,
        lon: Number.isNaN(lonNum) ? 0 : lonNum,
        wheelchairBoarding: stop.wheelchair_boarding, // "0", "1", or "2"
      };

      station.stops.push(stationStop);
    }
  });

  // Convert our stationMap back to an array
  return Array.from(stationMap.values());
}

/**
 * Main function: Download the GTFS zip, parse it, transform it, then clean up.
 */
export async function fetchGtfsStations(): Promise<Station[]> {
  try {
    // 1) Download the GTFS zip to the local temp path
    await downloadGtfsFile();

    // 2) Parse stops.txt from the zip
    const gtfsStops = await parseStops();

    // 3) Transform into our Station array
    const stations = transformStops(gtfsStops);

    // 4) Remove the temp file
    await unlink(GTFS_TEMP_PATH);

    return stations;
  } catch (error) {
    console.error('Error fetching GTFS data:', error);
    throw error;
  }
}

export async function cleanupGtfsTempFile(): Promise<void> {
  try {
    await unlink(GTFS_TEMP_PATH);
  } catch {
    // best-effort; missing file is fine
  }
}
