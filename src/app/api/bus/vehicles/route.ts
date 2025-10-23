import { NextRequest, NextResponse } from "next/server";
import { callBusApi, buildBusApiMeta, createBaseMeta } from "@/lib/bus/ctaBusClient";
import { normalizeVehicles, type VehiclesPayload } from "@/lib/bus/normalizers";
import { mapBusApiError } from "@/lib/bus/errorMapping";
import type { BusApiError, BusApiSuccess, BusVehicle } from "@/lib/types/cta";

export const dynamic = "force-dynamic";

const ENDPOINT = "getvehicles";
const CACHE_TTL_MS = 15_000;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get("rt") ?? undefined;
    const vehicleId = searchParams.get("vid") ?? undefined;

    if (!routeId && !vehicleId) {
        const meta = createBaseMeta({
            endpoint: ENDPOINT,
            params: {},
            cacheTtlMs: 0,
            status: 400,
        });
        return NextResponse.json<BusApiError>(
            {
                data: null,
                error: {
                    code: "CTA_BUS_BAD_REQUEST",
                    message: 'Provide either "rt" (route) or "vid" (vehicle id).',
                },
                meta,
            },
            { status: 400 }
        );
    }

    const cacheKey = `bus:${ENDPOINT}:${routeId ?? ""}:${vehicleId ?? ""}`;

    try {
        const result = await callBusApi<VehiclesPayload>({
            endpoint: ENDPOINT,
            params: {
                rt: routeId,
                vid: vehicleId,
            },
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        const data = normalizeVehicles(result.payload);
        const meta = buildBusApiMeta(result, { status: 200 });
        const success: BusApiSuccess<BusVehicle[]> = {
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
                vid: vehicleId ?? "",
            },
            cacheKey,
            cacheTtlMs: CACHE_TTL_MS,
        });
        return NextResponse.json<BusApiError>(mapped, {
            status: mapped.meta.status ?? 502,
        });
    }
}
