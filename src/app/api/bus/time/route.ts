import { NextResponse } from "next/server";
import { callBusApi, buildBusApiMeta } from "@/lib/bus/ctaBusClient";
import { normalizeTimeResponse, type TimePayload } from "@/lib/bus/normalizers";
import { mapBusApiError } from "@/lib/bus/errorMapping";
import type { BusApiError, BusApiSuccess, BusTime } from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "gettime";
const CACHE_KEY = "bus:gettime";
const CACHE_TTL_MS = 30_000;

export async function GET() {
    try {
        const result = await callBusApi<TimePayload>({
            endpoint: ENDPOINT,
            cacheKey: CACHE_KEY,
            cacheTtlMs: CACHE_TTL_MS,
        });
        const data = normalizeTimeResponse(result.payload);
        const meta = buildBusApiMeta(result, { status: 200 });
        const success: BusApiSuccess<BusTime> = {
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
