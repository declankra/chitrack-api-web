import { NextRequest, NextResponse } from "next/server";
import { callBusApi, buildBusApiMeta, createBaseMeta } from "@/lib/bus/ctaBusClient";
import { normalizePredictions, type PredictionsPayload } from "@/lib/bus/normalizers";
import { mapBusApiError } from "@/lib/bus/errorMapping";
import type { BusApiError, BusApiSuccess, BusPrediction } from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "getpredictions";
const DEFAULT_CACHE_TTL_MS = 15_000;

const collectStopIds = (searchParams: URLSearchParams): string[] => {
    const multi = searchParams.getAll("stpid");
    if (multi.length > 0) return multi.filter(Boolean);
    const alt = searchParams.getAll("stopId");
    if (alt.length > 0) return alt.filter(Boolean);
    const single = searchParams.get("stpid") ?? searchParams.get("stopId");
    return single ? [single] : [];
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const stopIds = collectStopIds(searchParams);
    const routeId = searchParams.get("rt") ?? undefined;
    const top = searchParams.get("top") ?? undefined;
    const vehicleId = searchParams.get("vid") ?? undefined;

    if (stopIds.length === 0) {
        const meta = createBaseMeta({
            endpoint: ENDPOINT,
            params: {
                stpid: "",
            },
            cacheTtlMs: 0,
            status: 400,
        });
        return NextResponse.json<BusApiError>(
            {
                data: null,
                error: {
                    code: "CTA_BUS_BAD_REQUEST",
                    message: 'At least one "stpid" query parameter is required.',
                },
                meta,
            },
            { status: 400 }
        );
    }

    const stpidParam = stopIds.join(",");
    const cacheTtlMs = top || vehicleId ? 0 : DEFAULT_CACHE_TTL_MS;
    const cacheKey = `bus:${ENDPOINT}:${stpidParam}:${routeId ?? ""}:${vehicleId ?? ""}:${top ?? ""}`;

    try {
        const result = await callBusApi<PredictionsPayload>({
            endpoint: ENDPOINT,
            params: {
                stpid: stpidParam,
                rt: routeId,
                top,
                vid: vehicleId,
            },
            requiredParams: ["stpid"],
            cacheKey,
            cacheTtlMs,
        });
        const data = normalizePredictions(result.payload);
        const meta = buildBusApiMeta(result, { status: 200 });

        const success: BusApiSuccess<BusPrediction[]> = {
            data,
            error: null,
            meta,
        };
        return NextResponse.json(success);
    } catch (error: unknown) {
        const mapped = mapBusApiError(error, {
            endpoint: ENDPOINT,
            params: {
                stpid: stpidParam,
                rt: routeId ?? "",
                vid: vehicleId ?? "",
                top: top ?? "",
            },
            cacheKey,
            cacheTtlMs,
        });
        return NextResponse.json<BusApiError>(mapped, {
            status: mapped.meta.status ?? 502,
        });
    }
}
