import {
    BusDetour,
    BusDirection,
    BusPattern,
    BusPatternPoint,
    BusPrediction,
    BusPredictionDynamicAction,
    BusRoute,
    BusStop,
    BusVehicle,
    BusDynamicActionSeverity,
    BusTime,
} from "@/lib/types/cta";
import { parseCtaDate } from "@/lib/utilities/timeUtils";
import type { BustimePayloadBase } from "@/lib/bus/ctaBusClient";

const normalizeNumber = (value: string | number | undefined): number | undefined => {
    if (value === undefined || value === null) return undefined;
    const asNumber = typeof value === "number" ? value : Number(value);
    return Number.isNaN(asNumber) ? undefined : asNumber;
};

export const normalizeTime = (timestamp?: string): string | undefined => {
    if (!timestamp) return undefined;
    const parsed = parseCtaDate(timestamp);
    return parsed ? parsed.toISOString() : undefined;
};

export interface TimePayload extends BustimePayloadBase {
    tm?: string;
    tmst?: string;
}

export const normalizeTimeResponse = (payload: TimePayload): BusTime => {
    const iso = normalizeTime(payload.tm ?? payload.tmst);
    return {
        currentTime: iso ?? new Date().toISOString(),
    };
};

const ensureHexColor = (color?: string): string | undefined => {
    if (!color) return undefined;
    const trimmed = color.trim();
    if (!trimmed) return undefined;
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
};

const DYNAMIC_ACTION_LOOKUP: Record<number, { label: string; description?: string; severity: BusDynamicActionSeverity }> = {
    1: { label: "Canceled", description: "This trip has been canceled.", severity: "critical" },
    2: { label: "Added Trip", description: "Extra bus service added.", severity: "info" },
    3: { label: "Reroute", description: "Bus is on a temporary reroute.", severity: "warning" },
    4: { label: "Express", description: "Trip will run express.", severity: "info" },
    5: { label: "Delay", description: "Bus is experiencing delays.", severity: "warning" },
    6: { label: "Stops Affected", description: "Some stops may be skipped.", severity: "warning" },
};

const normalizeDynamicAction = (raw: any): BusPredictionDynamicAction | undefined => {
    if (!raw) return undefined;
    const candidate = Array.isArray(raw) ? raw[0] : raw;
    if (!candidate) return undefined;
    const id = normalizeNumber(candidate.id);
    if (!id && id !== 0) return undefined;
    const mapping = DYNAMIC_ACTION_LOOKUP[id] ?? { label: candidate.t ?? "Service Update", severity: "info" as BusDynamicActionSeverity };
    const description = candidate.d ?? candidate.t ?? mapping.description;
    return {
        id,
        code: candidate.code ?? candidate.cd ?? undefined,
        label: mapping.label,
        description,
        severity: mapping.severity,
    };
};

const parseFlags = (flags?: string): string[] | undefined => {
    if (!flags) return undefined;
    const parts = flags
        .split(/[,\s]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
};

export interface RoutesPayload extends BustimePayloadBase {
    routes?: Array<{
        rt: string;
        rtnm: string;
        rtclr?: string;
        rtdd?: string;
        txtclr?: string;
    }>;
    tmst?: string;
}

export const normalizeRoutes = (payload: RoutesPayload): BusRoute[] => {
    if (!payload?.routes) return [];
    return payload.routes.map((route) => ({
        id: route.rt,
        name: route.rtnm,
        shortName: route.rt,
        color: ensureHexColor(route.rtclr),
        textColor: ensureHexColor(route.txtclr),
        slug: route.rtdd?.toLowerCase(),
    }));
};

export interface DirectionsPayload extends BustimePayloadBase {
    directions?: Array<{
        dir: string;
    }>;
    tmst?: string;
}

export const normalizeDirections = (payload: DirectionsPayload): BusDirection[] => {
    if (!payload?.directions) return [];
    return payload.directions.map((direction) => ({
        id: direction.dir,
        name: direction.dir,
    }));
};

export interface StopsPayload extends BustimePayloadBase {
    stops?: Array<{
        stpid: string;
        stpnm: string;
        lat: string | number;
        lon: string | number;
        seq?: number | string;
    }>;
    tmst?: string;
}

export const normalizeStops = (payload: StopsPayload, extras?: { routeId?: string; directionId?: string }): BusStop[] => {
    if (!payload?.stops) return [];
    return payload.stops.map((stop) => ({
        id: stop.stpid,
        name: stop.stpnm,
        latitude: normalizeNumber(stop.lat) ?? 0,
        longitude: normalizeNumber(stop.lon) ?? 0,
        sequence: normalizeNumber(stop.seq),
        routeId: extras?.routeId,
        directionId: extras?.directionId,
    }));
};

export interface PredictionsPayload extends BustimePayloadBase {
    prd?: Array<{
        tmstmp?: string;
        prdtm?: string;
        stpid: string;
        stpnm?: string;
        rt: string;
        rtdir?: string;
        des?: string;
        vid?: string;
        prdctdn?: string;
        dly?: string | boolean;
        flags?: string;
        dyn?: unknown;
    }>;
    tmst?: string;
}

const deriveMinutesUntil = (countdown?: string, predictedArrival?: string): number | undefined => {
    if (!countdown) {
        if (!predictedArrival) return undefined;
        const arrivalDate = predictedArrival ? new Date(predictedArrival) : null;
        if (!arrivalDate) return undefined;
        const diffMs = arrivalDate.getTime() - Date.now();
        return Math.round(diffMs / 60000);
    }
    if (/^\d+$/.test(countdown)) {
        return Number(countdown);
    }
    return undefined;
};

const isDelayed = (value?: string | boolean): boolean => {
    if (typeof value === "boolean") return value;
    if (!value) return false;
    return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "delay";
};

export const normalizePredictions = (payload: PredictionsPayload): BusPrediction[] => {
    if (!payload?.prd) return [];
    return payload.prd.map((prediction) => {
        const predictedArrival = normalizeTime(prediction.prdtm);
        const generatedAt = normalizeTime(prediction.tmstmp);
        const countdown = prediction.prdctdn;
        const minutesUntil = deriveMinutesUntil(countdown, predictedArrival);
        const due = countdown ? countdown.toUpperCase() === "DUE" || countdown === "0" : minutesUntil !== undefined && minutesUntil <= 0;
        return {
            routeId: prediction.rt,
            stopId: prediction.stpid,
            stopName: prediction.stpnm,
            directionId: prediction.rtdir,
            destination: prediction.des,
            vehicleId: prediction.vid,
            countdown,
            generatedAt,
            predictedArrival,
            sourceTimestamp: generatedAt,
            minutesUntil,
            isDue: due,
            isDelayed: isDelayed(prediction.dly),
            flags: parseFlags(prediction.flags),
            dynamicAction: normalizeDynamicAction(prediction.dyn),
        };
    });
};

export interface VehiclesPayload extends BustimePayloadBase {
    vehicle?: Array<{
        vid: string;
        rt?: string;
        rtdir?: string;
        pid?: string;
        lat: string | number;
        lon: string | number;
        hdg?: string | number;
        tmstmp?: string;
        prdtm?: string;
        dstp?: string | number;
        next_stop?: string;
        next_stpid?: string;
        next_stpnm?: string;
        dly?: string | boolean;
        pdis?: string | number;
        pdist?: string | number;
    }>;
    tmst?: string;
}

export const normalizeVehicles = (payload: VehiclesPayload): BusVehicle[] => {
    if (!payload?.vehicle) return [];
    return payload.vehicle.map((vehicle) => ({
        vehicleId: vehicle.vid,
        routeId: vehicle.rt,
        directionId: vehicle.rtdir,
        patternId: vehicle.pid,
        latitude: normalizeNumber(vehicle.lat) ?? 0,
        longitude: normalizeNumber(vehicle.lon) ?? 0,
        heading: normalizeNumber(vehicle.hdg),
        lastUpdated: normalizeTime(vehicle.tmstmp),
        predictedArrival: normalizeTime(vehicle.prdtm),
        nextStopId: vehicle.next_stpid ?? vehicle.next_stop ?? undefined,
        nextStopName: vehicle.next_stpnm,
        destination: vehicle.dstp ? String(vehicle.dstp) : undefined,
        distanceFromTerminal: normalizeNumber(vehicle.pdist ?? vehicle.pdis),
        isDelayed: isDelayed(vehicle.dly),
    }));
};

export interface PatternsPayload extends BustimePayloadBase {
    ptr?: Array<{
        pid: string;
        ln?: string | number;
        rt?: string;
        rtdir?: string;
        pt?: Array<{
            seq: number | string;
            lat: string | number;
            lon: string | number;
            typ?: string;
            stpid?: string;
            stpnm?: string;
            pdist?: string | number;
        }>;
    }>;
    tmst?: string;
}

export const normalizePatterns = (payload: PatternsPayload): BusPattern[] => {
    if (!payload?.ptr) return [];
    return payload.ptr.map((pattern) => ({
        id: pattern.pid,
        routeId: pattern.rt ?? "",
        directionId: pattern.rtdir,
        polyline: undefined,
        points:
            pattern.pt?.map<BusPatternPoint>((point) => ({
                sequence: normalizeNumber(point.seq) ?? 0,
                latitude: normalizeNumber(point.lat) ?? 0,
                longitude: normalizeNumber(point.lon) ?? 0,
                type: point.typ,
                stopId: point.stpid,
                stopName: point.stpnm,
                distanceFromStart: normalizeNumber(point.pdist),
            })) ?? [],
    }));
};

export interface DetoursPayload extends BustimePayloadBase {
    detours?: Array<{
        id: string;
        rtnm?: string;
        rt?: string;
        rtdir?: string;
        startdt?: string;
        enddt?: string;
        hdg?: string;
        desc?: string;
        url?: string;
        updtm?: string;
        lastmod?: string;
        rtdetours?: string;
        reason?: string;
    }>;
    tmst?: string;
}

export const normalizeDetours = (payload: DetoursPayload): BusDetour[] => {
    if (!payload?.detours) return [];
    return payload.detours.map((detour) => ({
        id: detour.id,
        routeId: detour.rt ?? detour.rtnm,
        directionId: detour.rtdir,
        start: normalizeTime(detour.startdt) ?? "",
        end: normalizeTime(detour.enddt),
        headline: detour.hdg ?? detour.rtdetours,
        description: detour.desc,
        url: detour.url,
        reason: detour.reason,
        lastUpdated: normalizeTime(detour.updtm ?? detour.lastmod),
    }));
};
