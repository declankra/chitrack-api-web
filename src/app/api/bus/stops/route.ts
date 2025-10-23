import { NextRequest, NextResponse } from "next/server";
import { callBusApi, buildBusApiMeta, createBaseMeta } from "@/lib/bus/ctaBusClient";
import { normalizeStops, type StopsPayload } from "@/lib/bus/normalizers";
import { mapBusApiError } from "@/lib/bus/errorMapping";
import type { BusApiError, BusApiSuccess, BusStop } from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "getstops";
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get("rt") ?? searchParams.get("routeId") ?? undefined;
    const directionId = searchParams.get("dir") ?? searchParams.get("directionId") ?? undefined;

    if (!routeId || !directionId) {
        const meta = createBaseMeta({
            endpoint: ENDPOINT,
            params: {
                rt: routeId ?? "",
                dir: directionId ?? "",
            },
            cacheTtlMs: CACHE_TTL_MS,
            status: 400,
        });
        return NextResponse.json<BusApiError>(
            {
                data: null,
                error: {
                    code: "CTA_BUS_BAD_REQUEST",
                    message: 'Query parameters "rt" and "dir" are required.',
                },
                meta,
            },
            { status: 400 }
        );
    }

    const cacheKey = `bus:${ENDPOINT}:${routeId}:${directionId}`;

    try {
        const result = await callBusApi<StopsPayload>({
            endpoint: ENDPOINT,
            params: { rt: routeId, dir: directionId },
            requiredParams: ["rt", "dir"],
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        const data = normalizeStops(result.payload, { routeId, directionId });
        const meta = buildBusApiMeta(result, { status: 200 });
        const success: BusApiSuccess<BusStop[]> = {
            data,
            error: null,
            meta,
        };
        return NextResponse.json(success);
    } catch (error: unknown) {
        const mapped = mapBusApiError(error, {
            endpoint: ENDPOINT,
            params: { rt: routeId, dir: directionId },
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        return NextResponse.json<BusApiError>(mapped, {
            status: mapped.meta.status ?? 502,
        });
    }
}
