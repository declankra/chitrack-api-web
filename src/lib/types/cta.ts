/**
 * CTA Transit Types
 * Centralized type definitions for CTA transit data structures: stations, stops, the CTA Train Tracker API responses, route types, and frontend-specific types
 */

///////////////////////////////
//        Route Types        
///////////////////////////////

/**
 * Valid CTA train route colors
 */
export type RouteColor = 'Red' | 'Blue' | 'Brn' | 'G' | 'Org' | 'P' | 'Pink' | 'Y';

/**
 * Tailwind CSS background color classes for each route
 */
export const ROUTE_COLORS: Record<RouteColor, string> = {
  Red: "bg-red-600",
  Blue: "bg-blue-600",
  Brn: "bg-amber-800",
  G: "bg-green-600",
  Org: "bg-orange-500",
  P: "bg-purple-600",
  Pink: "bg-pink-500",
  Y: "bg-yellow-500",
} as const;

///////////////////////////////
//     Core Station Types    
///////////////////////////////

/**
 * High-level station entity (the "parent station").
 * CTA "mapid" or "staId" is in the 4xxxx range identifying the entire station.
 * 
 * Represents a CTA Station, which can have multiple platform stops.
 * Example:
 *  - stationId: "40360" (Southport)
 *  - stationName: "Southport"
 *  - lat: 41.943744
 *  - lon: -87.663619
 *  - stops: array of StationStop objects (each representing a direction/platform)
 */
export interface Station {
    /** Parent Station ID (e.g., 40360 for Southport) */
    stationId: string;
    /** Human-friendly station name (e.g. "Southport") */
    stationName: string;
    /** The array of platform-specific stops (3xxxx IDs) */
    stops: StationStop[];
    /** Optional lat/lon for mapping the station center */
    lat?: number;
    lon?: number;
}

/**
 * Represents an individual platform/direction (stop) within a station.
 * CTA calls these "Stop IDs" "stpid" (3xxxx). For example:
 *   - stopId: "30070" (Service toward Kimball)
 *   - directionName: "Service toward Kimball" or "Service toward Loop"
 */
export interface StationStop {
    /** Stop ID (e.g., 30070 for Southport inbound) */
    stopId: string;
    /** Human-friendly stop name (e.g. "Southport"). The GTFS "stop_name" for this platform. This might be identical to stationName or might include extra route info, depending on CTA GTFS data. */
    stopName: string;
  /**
   * The GTFS "stop_desc", describing the service direction or other platform details.
   * For CTA, this often looks like "Service toward Loop" or "Service toward Kimball".
   * If no data was provided, it may default to "N/A".
   */
    stopDesc: string;
    /** Direction or platform description (e.g. "Service toward Loop"). For convenience, we store a direct "directionName" which is typically the same as stop_desc in CTA data. This might be used in the UI to quickly label the platform or direction. */
    directionName: string;
    /** Parent station ID reference */
    parentStationId: string;
    /** Optional lat/lon for the specific platform */
    lat?: number;
    lon?: number;
    /** Wheelchair boarding accessibility: "0" = unknown, "1" = accessible, "2" = not accessible */
    wheelchairBoarding?: string;
}

///////////////////////////////
//   Frontend-Specific Types 
///////////////////////////////

/**
 * Simplified station interface for frontend display
 */
export interface SimpleStation {
    stationId: string;
    stationName: string;
    stops: SimpleStop[];
}

/**
 * Simplified stop interface for frontend display
 */
export interface SimpleStop {
    stopId: string;
    stopName: string;
    directionName?: string;
    arrivals: SimpleArrival[];
}

/**
 * Simplified arrival interface for frontend display
 */
export interface SimpleArrival {
    rt: RouteColor;
    destNm: string;
    arrT: string;
    isDly: string;
}

///////////////////////////////
//      Arrival Types      
///////////////////////////////

/**
 * Core arrival information returned by CTA API
 * Represents a single Arrival record from the CTA Arrivals API.
 * Example usage: next arriving train at a given station or platform.
 */
export interface Arrival {
    staId: string;   // Parent station ID (4xxxx)
    stpId: string;   // Stop (platform) ID (3xxxx)
    staNm: string;   // Station name
    stpDe: string;   // Platform description (e.g. "Service toward Loop")
    rn: string;      // Train run number
    rt: string;      // Route Code (Red, Blue, Brn, etc.)
    destNm: string;  // Destination name
    arrT: string;    // CTA-provided predicted arrival time in the format "YYYYMMDD HH:mm:ss" (local Chicago time)
    prdt: string;    // Timestamp when prediction was generated
    isApp: string;   // "1" if approaching
    isDly: string;   // "1" if delayed
    isSch: string;   // "1" if schedule-based (no live data)
}

/**
 * Extended arrival information with additional fields
 */
export interface ArrivalEta extends Arrival {
    destSt: string;  // Destination station ID
    trDr: string;    // Direction code (1,5) used internally
    isFlt: string;   // "1" if a schedule fault was detected
    flags: string | null; // Not used currently
    lat: string;     // Train latitude
    lon: string;     // Train longitude
    heading: string; // Bearing in degrees (0-359)
}

///////////////////////////////
//       API Responses       
///////////////////////////////

/**
 * Response structure for the Arrivals API
 */
export interface ArrivalsApiResponse {
    ctatt: {
        tmst: string;               // Time when response was generated
        errCd: string;              // Error code
        errNm: string | null;       // Error message if any
        eta: ArrivalEta[];         // Array of arrivals
    };
}

/**
 * Response structure for the Follow Train API
 */
export interface FollowApiResponse {
    ctatt: {
        tmst: string;           // Time of response
        errCd: string;
        errNm: string | null;
        position: {
            lat: string;
            lon: string;
            heading: string;
        };
        eta: ArrivalEta[];
    };
}

/**
 * Train location information
 */
export interface TrainLocation {
    rn: string;       // Run number
    destSt: string;   // Destination station ID
    destNm: string;   // Destination name
    trDr: string;     // Direction code
    nextStaId: string;   // Next station ID
    nextStpId: string;   // Next stop ID
    nextStaNm: string;   // Next station name
    prdt: string;        // Prediction generation time
    arrT: string;        // Arrival time
    isApp: string;       // Approaching?
    isDly: string;       // Delayed?
    flags: string | null;
    lat: string;         // Current lat
    lon: string;         // Current lon
    heading: string;     // Bearing
}

/**
 * Response structure for the Locations API
 */
export interface LocationsApiResponse {
    ctatt: {
        tmst: string;       // Time of response
        errCd: string;
        errNm: string | null;
        route: Array<{
            "@name": string;    // e.g. "red"
            train: TrainLocation[];
        }>;
    };
}

///////////////////////////////
//    API Response Types     
///////////////////////////////

/**
 * Structured response for station arrivals
 * For aggregated arrivals at a station, we often have data grouped by station, then stops.
 * This interface is used in the station arrivals route (api/cta/arrivals/station).
 */
export interface StationArrivalsResponse {
    stationId: string;
    stationName: string;
    stops: Array<{
        stopId: string;
        stopName: string;
        route: string;
        arrivals: Arrival[];
    }>;
}

/**
 * Structured response for stop arrivals
 * For arrivals specifically at a single stop (api/cta/arrivals/stop).
 */
export interface StopArrivalsResponse {
    stopId: string;
    stopName: string;
    stopDesc?: string;
    directionName?: string;
    route: string;
    arrivals: Arrival[];
}

///////////////////////////////
//        Bus Types          
///////////////////////////////

export interface BusRoute {
    /** CTA route code (e.g., "20") */
    id: string;
    /** Human-friendly route name (e.g., "Madison") */
    name: string;
    /** Optional short code if distinct from id */
    shortName?: string;
    /** HEX color string supplied by CTA (e.g., "#3366CC") */
    color?: string;
    /** Optional contrasting text color */
    textColor?: string;
    /** Lowercased slug provided by CTA (rtdd) */
    slug?: string;
}

export interface BusDirection {
    /** Direction identifier returned by CTA (e.g., "Eastbound") */
    id: string;
    /** Human-friendly name to display */
    name: string;
}

export interface BusStop {
    /** CTA stop id */
    id: string;
    /** Display name */
    name: string;
    /** Latitude */
    latitude: number;
    /** Longitude */
    longitude: number;
    /** Sequence order provided by CTA (if available) */
    sequence?: number;
    /** Route this stop belongs to (when provided) */
    routeId?: string;
    /** Direction identifier (when provided) */
    directionId?: string;
}

export type BusDynamicActionSeverity = "info" | "warning" | "critical";

export interface BusPredictionDynamicAction {
    /** Numeric action id from CTA dynamic message */
    id: number;
    /** Optional code (CTA labels) */
    code?: string;
    /** Short label for badge rendering */
    label: string;
    /** Longer description shown in detail views */
    description?: string;
    /** Optional severity classification */
    severity?: BusDynamicActionSeverity;
}

export interface BusPrediction {
    /** Route code */
    routeId: string;
    /** Stop identifier */
    stopId: string;
    /** Stop name */
    stopName?: string;
    /** Direction / headsign */
    directionId?: string;
    /** Destination or headsign text */
    destination?: string;
    /** Vehicle identifier associated with the prediction */
    vehicleId?: string;
    /** CTA countdown string (e.g., "5", "DUE") */
    countdown?: string;
    /** ISO timestamp when CTA generated the prediction */
    generatedAt?: string;
    /** ISO timestamp of the predicted arrival */
    predictedArrival?: string;
    /** ISO timestamp reported as the response timestamp */
    sourceTimestamp?: string;
    /** Minutes until arrival, derived locally */
    minutesUntil?: number;
    /** Whether CTA indicates the bus is due */
    isDue?: boolean;
    /** CTA delay indicator */
    isDelayed?: boolean;
    /** Additional CTA flags */
    flags?: string[];
    /** CTA dynamic action payload */
    dynamicAction?: BusPredictionDynamicAction;
}

export interface BusVehicle {
    /** Vehicle id (CTA vid) */
    vehicleId: string;
    /** Current route code */
    routeId?: string;
    /** Direction identifier */
    directionId?: string;
    /** Latitude */
    latitude: number;
    /** Longitude */
    longitude: number;
    /** Heading in degrees */
    heading?: number;
    /** Pattern id vehicle is currently on */
    patternId?: string;
    /** ISO timestamp of last update */
    lastUpdated?: string;
    /** Predicted arrival time at next stop (ISO) */
    predictedArrival?: string;
    /** Next stop id */
    nextStopId?: string;
    /** Next stop name */
    nextStopName?: string;
    /** Destination name */
    destination?: string;
    /** Distance from terminal in miles */
    distanceFromTerminal?: number;
    /** CTA delay indicator */
    isDelayed?: boolean;
}

export interface BusPatternPoint {
    /** Sequence order from CTA */
    sequence: number;
    /** Latitude */
    latitude: number;
    /** Longitude */
    longitude: number;
    /** Point type ("W" waypoint, "S" stop, etc.) */
    type?: string;
    /** Stop id when point is a stop */
    stopId?: string;
    /** Stop name when provided */
    stopName?: string;
    /** Distance from start in miles */
    distanceFromStart?: number;
}

export interface BusPattern {
    /** CTA pattern id */
    id: string;
    /** Route code */
    routeId: string;
    /** Direction identifier */
    directionId?: string;
    /** Optional polyline string */
    polyline?: string;
    /** Ordered list of pattern points */
    points: BusPatternPoint[];
}

export interface BusDetour {
    /** CTA detour id */
    id: string;
    /** Affected route code (if provided) */
    routeId?: string;
    /** Optional direction or headsign text */
    directionId?: string;
    /** Start timestamp (ISO) */
    start: string;
    /** End timestamp (ISO, optional) */
    end?: string;
    /** Short headline */
    headline?: string;
    /** Detailed description */
    description?: string;
    /** Additional URL provided by CTA */
    url?: string;
    /** CTA supplied reason */
    reason?: string;
    /** Last updated timestamp in ISO format */
    lastUpdated?: string;
}

export interface BusTime {
    /** CTA server time in ISO format */
    currentTime: string;
}

export interface BusApiMeta {
    /** CTA supplied timestamp for response data */
    sourceUpdatedAt?: string;
    /** Server timestamp when request completed */
    queriedAt: string;
    /** TTL applied to cache entries in milliseconds */
    cacheTtlMs?: number;
    /** ISO timestamp when cached entry expires */
    cacheExpiresAt?: string;
    /** Cache identifier used internally */
    cacheKey?: string;
    /** CTA endpoint invoked (e.g., "getroutes") */
    ctaEndpoint: string;
    /** Params sent to CTA (stringified) */
    paramsUsed: Record<string, string | number>;
    /** Optional reason hint when CTA returns no data */
    reason?: string;
    /** HTTP status code returned to client */
    status?: number;
    /** Indicates if response was served from cache */
    servedFromCache?: boolean;
}

export interface BusApiSuccess<T> {
    data: T;
    error: null;
    meta: BusApiMeta;
}

export interface BusErrorDetail {
    code: string;
    message: string;
    details?: string;
}

export interface BusApiError {
    data: null;
    error: BusErrorDetail;
    meta: BusApiMeta;
}

export type BusApiResponse<T> = BusApiSuccess<T> | BusApiError;

export interface BusRawError {
    code?: string;
    msg: string;
}
