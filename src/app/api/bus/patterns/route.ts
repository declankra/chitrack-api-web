import { NextRequest, NextResponse } from "next/server";
import { callBusApi, buildBusApiMeta, createBaseMeta } from "@/lib/bus/ctaBusClient";
import { normalizePatterns, type PatternsPayload } from "@/lib/bus/normalizers";
import { mapBusApiError } from "@/lib/bus/errorMapping";
import type { BusApiError, BusApiSuccess, BusPattern } from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "getpatterns";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get("rt") ?? undefined;
    const patternId = searchParams.get("pid") ?? undefined;

    if (!routeId && !patternId) {
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
                    message: 'Provide either "rt" (route id) or "pid" (pattern id).',
                },
                meta,
            },
            { status: 400 }
        );
    }

    const cacheKey = `bus:${ENDPOINT}:${routeId ?? ""}:${patternId ?? ""}`;

    try {
        const result = await callBusApi<PatternsPayload>({
            endpoint: ENDPOINT,
            params: {
                rt: routeId,
                pid: patternId,
            },
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        const data = normalizePatterns(result.payload);
        const meta = buildBusApiMeta(result, { status: 200 });
        const success: BusApiSuccess<BusPattern[]> = {
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
                pid: patternId ?? "",
            },
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        return NextResponse.json<BusApiError>(mapped, {
            status: mapped.meta.status ?? 502,
        });
    }
}
