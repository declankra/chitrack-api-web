// src/app/api/monitor/trains/positions/route.ts
import { NextResponse } from 'next/server';
import type { RouteColor, LiveTrain, TrainPositionsResponse } from '@/lib/types/monitor';

export const dynamic = 'force-dynamic';

// CTA route codes mapping
const ROUTE_CODES: Record<string, RouteColor> = {
  red: 'Red',
  blue: 'Blue',
  brn: 'Brn',
  g: 'G',
  org: 'Org',
  p: 'P',
  pink: 'Pink',
  y: 'Y',
};

const ALL_ROUTES = ['red', 'blue', 'brn', 'g', 'org', 'p', 'pink', 'y'];

// Route display names
const ROUTE_NAMES: Record<RouteColor, string> = {
  Red: 'Red Line',
  Blue: 'Blue Line',
  Brn: 'Brown Line',
  G: 'Green Line',
  Org: 'Orange Line',
  P: 'Purple Line',
  Pink: 'Pink Line',
  Y: 'Yellow Line',
};

interface CTATrainPosition {
  rn: string;
  destSt: string;
  destNm: string;
  trDr: string;
  nextStaId: string;
  nextStpId: string;
  nextStaNm: string;
  prdt: string;
  arrT: string;
  isApp: string;
  isDly: string;
  flags: string | null;
  lat: string;
  lon: string;
  heading: string;
}

interface CTAPositionsResponse {
  ctatt: {
    tmst: string;
    errCd: string;
    errNm: string | null;
    route?: Array<{
      '@name': string;
      train?: CTATrainPosition[];
    }>;
  };
}

function transformTrainPosition(train: CTATrainPosition, routeCode: string): LiveTrain {
  const route = ROUTE_CODES[routeCode.toLowerCase()] || 'Red';

  return {
    runNumber: train.rn,
    route,
    routeName: ROUTE_NAMES[route],
    destinationId: train.destSt,
    destinationName: train.destNm,
    nextStationId: train.nextStaId,
    nextStationName: train.nextStaNm,
    arrivalTime: train.arrT,
    isApproaching: train.isApp === '1',
    isScheduled: false, // ttpositions doesn't have isSch
    isDelayed: train.isDly === '1',
    lat: parseFloat(train.lat),
    lon: parseFloat(train.lon),
    heading: parseInt(train.heading, 10) || 0,
    flags: train.flags || undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routesParam = searchParams.get('routes');

  // Determine which routes to fetch
  const routesToFetch = routesParam
    ? routesParam.split(',').filter((r) => ALL_ROUTES.includes(r.toLowerCase()))
    : ALL_ROUTES;

  if (routesToFetch.length === 0) {
    return NextResponse.json(
      { error: 'Invalid routes parameter' },
      { status: 400 }
    );
  }

  const apiKey = process.env.CTA_TRAIN_API_KEY;
  if (!apiKey) {
    console.error('CTA_TRAIN_API_KEY is not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Fetch positions for all requested routes in parallel
    const positionPromises = routesToFetch.map(async (route) => {
      const url = `https://lapi.transitchicago.com/api/1.0/ttpositions.aspx?key=${apiKey}&rt=${route}&outputType=JSON`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 15 }, // Cache for 15 seconds
      });

      if (!response.ok) {
        console.error(`Failed to fetch positions for ${route}: ${response.status}`);
        return [];
      }

      const data: CTAPositionsResponse = await response.json();

      if (data.ctatt.errCd !== '0') {
        console.error(`CTA API error for ${route}: ${data.ctatt.errNm}`);
        return [];
      }

      // Extract trains from response
      const routeData = data.ctatt.route?.[0];
      if (!routeData?.train) {
        return [];
      }

      return routeData.train.map((train) => transformTrainPosition(train, route));
    });

    const results = await Promise.all(positionPromises);
    const allTrains = results.flat();

    const response: TrainPositionsResponse = {
      trains: allTrains,
      timestamp: new Date().toISOString(),
      count: allTrains.length,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Error fetching train positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch train positions' },
      { status: 500 }
    );
  }
}
