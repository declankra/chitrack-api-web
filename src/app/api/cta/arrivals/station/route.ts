// src/app/api/cta/arrivals/station/route.ts
// NOTE: the max number of mapids you can request is 4. meaning you can only request 4 stations at a time.

import { NextRequest, NextResponse } from "next/server";
import { fetchTrainArrivalsForStations } from "@/lib/nearby/arrivalsFanOut";

export const dynamic = "force-dynamic";

/**
 * GET handler for /api/cta/arrivals/station
 * Usage: GET /api/cta/arrivals/station?mapids=40380,41450
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapidsParam = searchParams.get("mapids");

    if (!mapidsParam) {
      return NextResponse.json({ error: "Missing required parameter: mapids" }, { status: 400 });
    }

    const stationIds = mapidsParam.split(",").filter((id) => id.trim() !== "");
    if (stationIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid mapids parameter: must contain at least one ID" },
        { status: 400 }
      );
    }
    if (stationIds.length > 4) {
      return NextResponse.json(
        { error: "Too many station IDs requested. Maximum is 4 per request." },
        { status: 400 }
      );
    }

    const arrivalData = await fetchTrainArrivalsForStations(stationIds);
    return NextResponse.json(arrivalData);
  } catch (error) {
    console.error("Error in station arrivals API route:", error);
    return NextResponse.json(
      {
        error:
          "It looks like we couldn't fetch live data, which can happen if your internet connection was temporarily lost. Please check your connection and try again.",
      },
      { status: 500 }
    );
  }
}
