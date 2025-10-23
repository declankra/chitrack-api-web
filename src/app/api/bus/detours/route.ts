import { NextRequest, NextResponse } from "next/server";
import { callBusApi, buildBusApiMeta } from "@/lib/bus/ctaBusClient";
import { normalizeDetours, type DetoursPayload } from "@/lib/bus/normalizers";
import { mapBusApiError } from "@/lib/bus/errorMapping";
import type { BusApiError, BusApiSuccess, BusDetour } from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "getdetours";
const CACHE_TTL_MS = 2 * 60 * 1000;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get("rt") ?? undefined;
    const stopId = searchParams.get("stpid") ?? searchParams.get("stopId") ?? undefined;

    const cacheKey = `bus:${ENDPOINT}:${routeId ?? ""}:${stopId ?? ""}`;

    try {
        const result = await callBusApi<DetoursPayload>({
            endpoint: ENDPOINT,
            params: {
                rt: routeId,
                stpid: stopId,
            },
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        const data = normalizeDetours(result.payload);
        const meta = buildBusApiMeta(result, { status: 200 });
        const success: BusApiSuccess<BusDetour[]> = {
            data,
            error: null,
            meta,
        };
        return NextResponse.json(success);
    } catch (error: unknown) {
        const mapped = mapBusApiError(error, {
            endpoint: ENDPOINT,
            params: {
                rt: routeId ?? "",
                stpid: stopId ?? "",
            },
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        return NextResponse.json<BusApiError>(mapped, {
            status: mapped.meta.status ?? 502,
        });
    }
}
