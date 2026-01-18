// src/app/api/monitor/status/route.ts
import { NextResponse } from 'next/server';
import type {
  RouteColor,
  SystemStatus,
  SystemHealthStatus,
  ServiceStatus,
  LineStatus,
} from '@/lib/types/monitor';

export const dynamic = 'force-dynamic';

const ALL_ROUTES: RouteColor[] = ['Red', 'Blue', 'Brn', 'G', 'Org', 'P', 'Pink', 'Y'];

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

// CTA route code mapping
const CTA_ROUTE_CODES: Record<RouteColor, string> = {
  Red: 'red',
  Blue: 'blue',
  Brn: 'brn',
  G: 'g',
  Org: 'org',
  P: 'p',
  Pink: 'pink',
  Y: 'y',
};

interface CTATrainPosition {
  rn: string;
  isDly: string;
  isApp: string;
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

// Fetch train count and delay info for a route
async function fetchRouteStatus(
  route: RouteColor,
  apiKey: string
): Promise<{ activeCount: number; delayedCount: number }> {
  try {
    const code = CTA_ROUTE_CODES[route];
    const url = `https://lapi.transitchicago.com/api/1.0/ttpositions.aspx?key=${apiKey}&rt=${code}&outputType=JSON`;

    const response = await fetch(url, {
      next: { revalidate: 15 },
    });

    if (!response.ok) {
      return { activeCount: 0, delayedCount: 0 };
    }

    const data: CTAPositionsResponse = await response.json();

    if (data.ctatt.errCd !== '0' || !data.ctatt.route?.[0]?.train) {
      return { activeCount: 0, delayedCount: 0 };
    }

    const trains = data.ctatt.route[0].train;
    const activeCount = trains.length;
    const delayedCount = trains.filter((t) => t.isDly === '1').length;

    return { activeCount, delayedCount };
  } catch {
    return { activeCount: 0, delayedCount: 0 };
  }
}

// Determine line service status
function determineLineStatus(activeCount: number, delayedCount: number): ServiceStatus {
  if (activeCount === 0) return 'down';
  const delayRate = delayedCount / activeCount;
  if (delayRate > 0.3) return 'disrupted';
  return 'operational';
}

// Calculate on-time performance estimate
function calculateOnTimePerformance(activeCount: number, delayedCount: number): number {
  if (activeCount === 0) return 100;
  return Math.round(((activeCount - delayedCount) / activeCount) * 100 * 10) / 10;
}

// Determine overall system health
function determineOverallHealth(lines: Partial<Record<RouteColor, LineStatus>>): SystemHealthStatus {
  const statuses = Object.values(lines);
  const downCount = statuses.filter((l) => l?.status === 'down').length;
  const disruptedCount = statuses.filter((l) => l?.status === 'disrupted').length;

  if (downCount > 0) return 'critical';
  if (disruptedCount >= 3) return 'critical';
  if (disruptedCount > 0) return 'degraded';
  return 'nominal';
}

export async function GET() {
  const apiKey = process.env.CTA_TRAIN_API_KEY;

  if (!apiKey) {
    console.error('CTA_TRAIN_API_KEY is not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Fetch status for all routes in parallel
    const routeStatuses = await Promise.all(
      ALL_ROUTES.map(async (route) => {
        const status = await fetchRouteStatus(route, apiKey);
        return { route, ...status };
      })
    );

    // Build line status map
    const lines: Partial<Record<RouteColor, LineStatus>> = {};
    let totalActive = 0;
    let totalDelayed = 0;
    let totalAlerts = 0;

    routeStatuses.forEach(({ route, activeCount, delayedCount }) => {
      totalActive += activeCount;
      totalDelayed += delayedCount;

      const status = determineLineStatus(activeCount, delayedCount);
      const onTimePerformance = calculateOnTimePerformance(activeCount, delayedCount);

      lines[route] = {
        route,
        routeName: ROUTE_NAMES[route],
        status,
        onTimePerformance,
        activeTrains: activeCount,
        scheduledTrains: activeCount, // We don't have scheduled data
        delayedTrains: delayedCount,
        avgHeadway: activeCount > 0 ? Math.round(60 / activeCount * 10) / 10 : 0,
        alerts: 0, // Would need to fetch from alerts API
      };

      if (status === 'disrupted' || status === 'down') {
        totalAlerts++;
      }
    });

    const overallHealth = determineOverallHealth(lines);

    // Determine train system status
    const trainSystemStatus: ServiceStatus =
      totalActive === 0
        ? 'down'
        : totalDelayed / totalActive > 0.2
        ? 'disrupted'
        : 'operational';

    const now = new Date().toISOString();

    const systemStatus: SystemStatus = {
      overall: overallHealth,
      timestamp: now,
      trains: {
        status: trainSystemStatus,
        activeCount: totalActive,
        scheduledCount: totalActive,
        delayedCount: totalDelayed,
        onTimePerformance: calculateOnTimePerformance(totalActive, totalDelayed),
      },
      buses: {
        status: 'operational', // Would need bus API integration
        activeCount: 0,
        delayedCount: 0,
      },
      alerts: {
        total: totalAlerts,
        critical: Object.values(lines).filter((l) => l?.status === 'down').length,
        major: Object.values(lines).filter((l) => l?.status === 'disrupted').length,
        minor: 0,
      },
      lines,
      dataFreshness: {
        trains: now,
        buses: now,
        alerts: now,
        weather: now,
      },
    };

    return NextResponse.json(systemStatus, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system status' },
      { status: 500 }
    );
  }
}
