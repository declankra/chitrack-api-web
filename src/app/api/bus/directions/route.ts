import { NextRequest, NextResponse } from "next/server";
import { callBusApi, buildBusApiMeta, createBaseMeta } from "@/lib/bus/ctaBusClient";
import { normalizeDirections, type DirectionsPayload } from "@/lib/bus/normalizers";
import { mapBusApiError } from "@/lib/bus/errorMapping";
import type { BusApiError, BusApiSuccess, BusDirection } from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "getdirections";
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get("rt") ?? searchParams.get("routeId") ?? undefined;

    if (!routeId) {
        const meta = createBaseMeta({
            endpoint: ENDPOINT,
            params: {},
            cacheTtlMs: CACHE_TTL_MS,
            status: 400,
        });
        return NextResponse.json<BusApiError>(
            {
                data: null,
                error: {
                    code: "CTA_BUS_BAD_REQUEST",
                    message: 'Query parameter "rt" is required.',
                },
                meta,
            },
            { status: 400 }
        );
    }

    const cacheKey = `bus:${ENDPOINT}:${routeId}`;

    try {
        const result = await callBusApi<DirectionsPayload>({
            endpoint: ENDPOINT,
            params: { rt: routeId },
            requiredParams: ["rt"],
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        const data = normalizeDirections(result.payload);
        const meta = buildBusApiMeta(result, { status: 200 });
        const success: BusApiSuccess<BusDirection[]> = {
            data,
            error: null,
            meta,
        };
        return NextResponse.json(success);
    } catch (error: unknown) {
        const mapped = mapBusApiError(error, {
            endpoint: ENDPOINT,
            params: { rt: routeId },
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        return NextResponse.json<BusApiError>(mapped, {
            status: mapped.meta.status ?? 502,
        });
    }
}
