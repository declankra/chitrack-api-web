// src/app/api/cta/stations/route.ts
import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/gtfs/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await getCatalog();
    if (!catalog.trainStations.length) {
      throw new Error("No stations found in GTFS data");
    }
    return NextResponse.json(catalog.trainStations);
  } catch (error) {
    console.error("Error in stations API route:", error);
    return NextResponse.json(
      {
        error: "Unable to fetch station data. Please check your internet connection and try refreshing the page.",
        code: "CONNECTION_ERROR",
      },
      { status: 500 }
    );
  }
}
