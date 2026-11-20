// src/app/api/cta/arrivals/stop/route.ts
import { NextRequest, NextResponse } from "next/server"
import { Arrival, ArrivalsApiResponse, StopArrivalsResponse } from "@/lib/types/cta"
import { isTrainFeedDown, TRAIN_FEED_DOWN_MESSAGE } from "@/lib/utilities/trainFeedStatus"

export const dynamic = 'force-dynamic';

// Configuration constants
const CTA_API_KEY = process.env.CTA_TRAIN_API_KEY
const CTA_API_TIMEOUT_MS = 5000 // 5 seconds timeout for CTA API
const MAX_RETRIES = 2 // Maximum number of retries for CTA API
const MAX_PAST_MINUTES = 2 // 2 minutes in the past to still show an arrival
const TIME_OFFSET_MS = 5000 // Adjustable time offset to correct for server/CTA time differences

/**
 * Helper to parse arrival time strings and return a numerical timestamp.
 * Handles both CTA format "YYYYMMDD HH:mm:ss" and ISO 8601 format "YYYY-MM-DDThh:mm:ss"
 * If parsing fails, returns Infinity so sorting still works.
 */
function parseArrivalTime(timeStr: string): number {
  try {
    // Check if the string is in ISO 8601 format (contains 'T' and possibly 'Z')
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    
    // Handle CTA format "YYYYMMDD HH:mm:ss"
    const [datePart, timePart] = timeStr.split(" ");
    if (!datePart || !timePart) return Infinity;
    
    const year = +datePart.slice(0, 4);
    const month = +datePart.slice(4, 6) - 1; // zero-based
    const day = +datePart.slice(6, 8);

    const [hour, minute, second] = timePart.split(":").map((x) => +x);
    const parsedDate = new Date(year, month, day, hour, minute, second);
    
    if (Number.isNaN(parsedDate.getTime())) return Infinity;
    return parsedDate.getTime();
  } catch (error) {
    console.warn("Error parsing arrival time:", timeStr, error);
    return Infinity;
  }
}

/**
 * Checks if an arrival time is not too far in the past
 * @param arrivalTime CTA arrival time string
 * @returns boolean indicating if arrival should be included
 */
function isRelevantArrival(arrivalTime: string): boolean {
  const timestamp = parseArrivalTime(arrivalTime);
  if (timestamp === Infinity) return true; // If we can't parse, include it
  
  const now = Date.now() + TIME_OFFSET_MS; // Apply time offset correction
  const diffMs = timestamp - now;
  const diffMinutes = diffMs / 60000;
  
  // Debug logging to help diagnose time-related issues
  const isRelevant = diffMinutes > -MAX_PAST_MINUTES;
  console.log(`Arrival time: ${arrivalTime}, diff minutes: ${diffMinutes.toFixed(2)}, relevant: ${isRelevant}`);
  
  // Include if it's in the future or within MAX_PAST_MINUTES of the past
  return isRelevant;
}

/**
 * Checks if there are any relevant arrivals in the array
 * If not, return all arrivals to avoid empty results
 */
function filterRelevantArrivals(arrivals: Arrival[]): Arrival[] {
  // First attempt to filter by our relevance criteria
  const relevantArrivals = arrivals.filter(arr => isRelevantArrival(arr.arrT));
  
  // If filtering removed ALL arrivals, return the original set
  // This prevents empty results due to clock synchronization issues
  if (relevantArrivals.length === 0 && arrivals.length > 0) {
    console.log(`Filtering removed all ${arrivals.length} arrivals - returning all instead`);
    return arrivals;
  }
  
  return relevantArrivals;
}

/**
 * Fetch data from CTA API with timeout and retry logic
 */
async function fetchCtaApiWithRetry(url: string, retryCount = 0): Promise<Response> {
  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CTA_API_TIMEOUT_MS);
    
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // If response is not ok and we haven't exceeded max retries, retry
      if (retryCount < MAX_RETRIES) {
        console.log(`CTA API returned ${response.status}, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        return fetchCtaApiWithRetry(url, retryCount + 1);
      }
      console.error(`CTA API error after ${retryCount} retries: Status ${response.status}`);
      throw new Error("It looks like we couldn't fetch live data, which can happen if your internet connection was temporarily lost. Please check your connection and try again.");
    }
    
    return response;
  } catch (error: any) {
    // If we have retries left and it's a timeout or network error, retry
    if (retryCount < MAX_RETRIES && 
        (error.name === 'AbortError' || error.name === 'TypeError' || error.message?.includes('network'))) {
      console.log(`CTA API request failed with ${error.message}, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      return fetchCtaApiWithRetry(url, retryCount + 1);
    }
    
    // Otherwise, rethrow
    console.error(`CTA API fetch error after ${retryCount} retries:`, error);
    throw error;
  }
}

/**
 * Fetch fresh data directly from CTA API for a given stop ID
 */
async function fetchFreshStopData(stopId: string): Promise<StopArrivalsResponse> {
  // Build CTA Arrivals request
  const baseUrl = "https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx";
  const urlParams = new URLSearchParams({
    key: CTA_API_KEY!,
    outputType: "JSON",
    stpid: stopId,
    max: "20", // fetch up to 10 so we can filter down to 3 if we want
  });
  
  const ctaUrl = `${baseUrl}?${urlParams.toString()}`;
  console.log(`Requesting fresh data from CTA API for stop: ${stopId}`);
  
  try {
    // Fetch with retry and timeout
    const ctaResponse = await fetchCtaApiWithRetry(ctaUrl);
    const data: ArrivalsApiResponse = await ctaResponse.json();
    
    // Check for CTA API-level errors
    if (data.ctatt.errCd !== "0") {
      console.error(
        "CTA API Error:",
        data.ctatt.errNm,
        "(Code:",
        data.ctatt.errCd,
        ")"
      );
      throw new Error("It looks like we couldn't fetch live data, which can happen if your internet connection was temporarily lost. Please check your connection and try again.");
    }

    const rawArrivals: Arrival[] = data.ctatt.eta || [];
    console.log(`CTA API returned ${rawArrivals.length} raw arrivals for stop ${stopId}`);
    
    let result: StopArrivalsResponse;
    
    if (rawArrivals.length === 0) {
      // no arrivals returned
      result = {
        stopId,
        stopName: "Unknown Stop", // Provide a default name if none found
        route: "",
        arrivals: [],
      };
    } else {
      // We assume all arrivals share the same stpId/stpDe if the CTA returned multiple
      const stpId = rawArrivals[0].stpId;
      const stpDe = rawArrivals[0].stpDe || "Unknown Stop"; // Add fallback for empty stop description
      const route = rawArrivals[0].rt;

      // Filter out arrivals that are too far in the past
      // But make sure we don't end up with empty results
      const relevantArrivals = filterRelevantArrivals(rawArrivals);
      console.log(`After filtering: ${relevantArrivals.length} relevant arrivals remain`);
      
      // Sort remaining arrivals by time ascending
      relevantArrivals.sort((a, b) => parseArrivalTime(a.arrT) - parseArrivalTime(b.arrT));

      // Take up to 3
      const arrivals = relevantArrivals;

      // final response object
      result = {
        stopId: stpId,
        stopName: stpDe,
        route: route,
        arrivals: arrivals,
      };
    }
    
    console.log(`Successfully processed data for stop ${stopId}`);
    return result;

  } catch (error) {
    console.error(`Failed to fetch or process CTA data for stop ${stopId}:`, error);
    // Rethrow the error to be handled by the main GET handler
    throw error; 
  }
}

/**
 * GET /api/cta/arrivals/stop?stopid=30170
 *
 * - Fetches arrivals for a single CTA stop ID.
 * - Returns up to 3 upcoming arrivals, sorted by time.
 * - Directly fetches data from CTA API on each request.
 */
export async function GET(request: NextRequest) {
  let stopIdParam: string | null = null;

  try {
    if (!CTA_API_KEY) {
      return NextResponse.json(
        { error: "CTA_TRAIN_API_KEY not set in environment." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    stopIdParam = searchParams.get("stopid");
    if (!stopIdParam) {
      return NextResponse.json(
        { error: "Please provide a 'stopid' query parameter." },
        { status: 400 }
      );
    }
    
    const stopId = stopIdParam.trim();
    if (stopId === "") {
      return NextResponse.json(
        { error: "Invalid stopid parameter provided." },
        { status: 400 }
      );
    }
    
    console.log(`API call for stop arrivals: ${stopId}`);

    // Directly fetch fresh data for the stop
    const result = await fetchFreshStopData(stopId);

    // An empty list means "no trains" to the app, so do not send one when CTA's feed is down
    if (result.arrivals.length === 0 && (await isTrainFeedDown())) {
      return NextResponse.json({ error: TRAIN_FEED_DOWN_MESSAGE }, { status: 503 });
    }

    // Return the fresh data
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error in Stop Arrivals API route:", error);
    // The rider reached us, so a CTA failure is not their internet connection
    if (await isTrainFeedDown()) {
      return NextResponse.json({ error: TRAIN_FEED_DOWN_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { 
        error: "It looks like we couldn't fetch live data, which can happen if your internet connection was temporarily lost. Please check your connection and try again.", 
        details: error?.message || "Unknown error",
        stop_id: stopIdParam || "none"
      },
      { status: 500 }
    );
  }
}