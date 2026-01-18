// src/app/api/monitor/trains/follow/route.ts
import { NextRequest, NextResponse } from 'next/server';

const CTA_API_KEY = process.env.CTA_TRAIN_API_KEY;
const CTA_BASE_URL = 'https://lapi.transitchicago.com/api/1.0';

// Route color mapping
const ROUTE_NAMES: Record<string, string> = {
  Red: 'Red Line',
  Blue: 'Blue Line',
  Brn: 'Brown Line',
  G: 'Green Line',
  Org: 'Orange Line',
  P: 'Purple Line',
  Pink: 'Pink Line',
  Y: 'Yellow Line',
};

interface CTAFollowResponse {
  ctatt: {
    tmst: string;
    errCd: string;
    errNm: string | null;
    position?: {
      lat: string;
      lon: string;
      heading: string;
    };
    eta?: Array<{
      staId: string;
      stpId: string;
      staNm: string;
      stpDe: string;
      rn: string;
      rt: string;
      destSt: string;
      destNm: string;
      trDr: string;
      prdt: string;
      arrT: string;
      isApp: string;
      isSch: string;
      isDly: string;
      isFlt: string;
      flags: string | null;
      lat: string;
      lon: string;
      heading: string;
    }>;
  };
}

interface TrainFollowData {
  runNumber: string;
  route: string;
  routeName: string;
  position: {
    lat: number;
    lon: number;
    heading: number;
  };
  destination: string;
  isDelayed: boolean;
  upcomingStops: Array<{
    stationId: string;
    stationName: string;
    stopDescription: string;
    arrivalTime: string;
    predictedTime: string;
    minutesAway: number;
    isApproaching: boolean;
    isScheduled: boolean;
    isDelayed: boolean;
  }>;
  timestamp: string;
}

function parseArrivalTime(prdt: string, arrT: string): { predicted: Date; arrival: Date; minutesAway: number } {
  // CTA format: YYYYMMDD HH:MM:SS
  const parseCtaDate = (dateStr: string): Date => {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(12, 14));
    const second = parseInt(dateStr.substring(15, 17));
    return new Date(year, month, day, hour, minute, second);
  };

  const predicted = parseCtaDate(prdt);
  const arrival = parseCtaDate(arrT);
  const now = new Date();
  const minutesAway = Math.max(0, Math.round((arrival.getTime() - now.getTime()) / (1000 * 60)));

  return { predicted, arrival, minutesAway };
}

function transformFollowData(data: CTAFollowResponse, runNumber: string): TrainFollowData | null {
  const etas = data.ctatt.eta;

  if (!etas || etas.length === 0) {
    return null;
  }

  // Get the first ETA to determine train info
  const firstEta = etas[0];

  // Get position from the first ETA or position object
  const position = data.ctatt.position || {
    lat: firstEta.lat,
    lon: firstEta.lon,
    heading: firstEta.heading,
  };

  const upcomingStops = etas.map((eta) => {
    const { arrival, minutesAway } = parseArrivalTime(eta.prdt, eta.arrT);

    return {
      stationId: eta.staId,
      stationName: eta.staNm,
      stopDescription: eta.stpDe,
      arrivalTime: eta.arrT,
      predictedTime: eta.prdt,
      minutesAway,
      isApproaching: eta.isApp === '1',
      isScheduled: eta.isSch === '1',
      isDelayed: eta.isDly === '1',
    };
  });

  // Sort by arrival time
  upcomingStops.sort((a, b) => a.minutesAway - b.minutesAway);

  const isDelayed = upcomingStops.some((stop) => stop.isDelayed);

  return {
    runNumber,
    route: firstEta.rt,
    routeName: ROUTE_NAMES[firstEta.rt] || firstEta.rt,
    position: {
      lat: parseFloat(position.lat),
      lon: parseFloat(position.lon),
      heading: parseInt(position.heading) || 0,
    },
    destination: firstEta.destNm,
    isDelayed,
    upcomingStops,
    timestamp: data.ctatt.tmst,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runNumber = searchParams.get('run');

    if (!runNumber) {
      return NextResponse.json(
        { error: 'Run number is required' },
        { status: 400 }
      );
    }

    if (!CTA_API_KEY) {
      return NextResponse.json(
        { error: 'CTA API key not configured' },
        { status: 500 }
      );
    }

    // Call CTA ttfollow endpoint
    const url = `${CTA_BASE_URL}/ttfollow.aspx?key=${CTA_API_KEY}&runnumber=${runNumber}&outputType=JSON`;

    const response = await fetch(url, {
      next: { revalidate: 15 }, // Cache for 15 seconds
    });

    if (!response.ok) {
      throw new Error(`CTA API returned ${response.status}`);
    }

    const data: CTAFollowResponse = await response.json();

    // Check for API errors
    if (data.ctatt.errCd !== '0') {
      return NextResponse.json(
        {
          error: data.ctatt.errNm || 'Train not found or no longer in service',
          code: data.ctatt.errCd
        },
        { status: 404 }
      );
    }

    const trainData = transformFollowData(data, runNumber);

    if (!trainData) {
      return NextResponse.json(
        { error: 'No data available for this train' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      train: trainData,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching train follow data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch train data' },
      { status: 500 }
    );
  }
}
