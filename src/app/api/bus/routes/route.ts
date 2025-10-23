import { NextResponse } from "next/server";
import { callBusApi, buildBusApiMeta } from "@/lib/bus/ctaBusClient";
import { normalizeRoutes, type RoutesPayload } from "@/lib/bus/normalizers";
import { mapBusApiError } from "@/lib/bus/errorMapping";
import type { BusApiError, BusApiSuccess, BusRoute } from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "getroutes";
const CACHE_KEY = "bus:getroutes";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function GET() {
    try {
        const result = await callBusApi<RoutesPayload>({
            endpoint: ENDPOINT,
            cacheKey: CACHE_KEY,
            cacheTtlMs: CACHE_TTL_MS,
        });
        const data = normalizeRoutes(result.payload);
        const meta = buildBusApiMeta(result, { status: 200 });
        const success: BusApiSuccess<BusRoute[]> = {
            data,
            error: null,
            meta,
        };
        return NextResponse.json(success);
    } catch (error: unknown) {
        const mapped = mapBusApiError(error, {
            endpoint: ENDPOINT,
            params: {},
            cacheKey: CACHE_KEY,
            cacheTtlMs: CACHE_TTL_MS,
        });
        return NextResponse.json<BusApiError>(mapped, {
            status: mapped.meta.status ?? 502,
        });
    }
}
