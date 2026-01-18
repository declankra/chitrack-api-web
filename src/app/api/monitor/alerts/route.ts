// src/app/api/monitor/alerts/route.ts
import { NextResponse } from 'next/server';
import type {
  CTAAlert,
  AlertSeverity,
  AlertCategory,
  AlertImpact,
  AffectedService,
  AlertsResponse,
} from '@/lib/types/monitor';

export const dynamic = 'force-dynamic';

// CTA Customer Alerts API
const CTA_ALERTS_API = 'https://www.transitchicago.com/api/1.0/alerts.aspx';

interface CTAAlertResponse {
  CTAAlerts: {
    TimeStamp: string;
    ErrorCode: string;
    ErrorMessage: string | null;
    Alert?: CTARawAlert[];
  };
}

interface CTARawAlert {
  AlertId: string;
  Headline: string;
  ShortDescription: string;
  FullDescription: {
    '#cdata-section'?: string;
  };
  SeverityScore: string;
  SeverityColor: string;
  SeverityCSS: string;
  Impact: string;
  EventStart: string;
  EventEnd?: string;
  TBD: string;
  MajorAlert: string;
  AlertURL?: {
    '#cdata-section'?: string;
  };
  ImpactedService: {
    Service: CTARawService | CTARawService[];
  };
  ttim?: string;
  GUID: string;
}

interface CTARawService {
  ServiceType: string;
  ServiceTypeDescription: string;
  ServiceName: string;
  ServiceId: string;
  ServiceBackColor: string;
  ServiceTextColor: string;
}

// Map CTA severity to our types
function mapSeverity(score: string): AlertSeverity {
  const numScore = parseInt(score, 10);
  if (numScore >= 90) return 'critical';
  if (numScore >= 70) return 'major';
  if (numScore >= 40) return 'minor';
  return 'info';
}

// Map CTA impact to our types
function mapImpact(impact: string): AlertImpact {
  const impactLower = impact.toLowerCase();
  if (impactLower.includes('suspend') || impactLower.includes('no service')) return 'suspended';
  if (impactLower.includes('reroute') || impactLower.includes('bypass')) return 'reroute';
  if (impactLower.includes('delay')) return 'delays';
  if (impactLower.includes('reduced')) return 'reduced-service';
  if (impactLower.includes('advisory') || impactLower.includes('alert')) return 'advisory';
  return 'normal';
}

// Determine alert category from headline and description
function determineCategory(headline: string, description: string): AlertCategory {
  const combined = `${headline} ${description}`.toLowerCase();
  if (combined.includes('planned') || combined.includes('construction') || combined.includes('work')) {
    return 'planned-work';
  }
  if (combined.includes('delay') || combined.includes('slow')) {
    return 'delay';
  }
  if (combined.includes('emergency') || combined.includes('police') || combined.includes('fire')) {
    return 'emergency';
  }
  if (combined.includes('elevator') || combined.includes('escalator') || combined.includes('accessibility')) {
    return 'accessibility';
  }
  if (combined.includes('schedule') || combined.includes('service change')) {
    return 'service-change';
  }
  return 'information';
}

// Transform CTA service to our type
function transformService(service: CTARawService): AffectedService {
  return {
    type: service.ServiceType.toLowerCase().includes('bus') ? 'bus' : 'train',
    routeId: service.ServiceId,
    routeName: service.ServiceName,
    routeColor: service.ServiceBackColor,
  };
}

// Transform raw CTA alert to our type
function transformAlert(raw: CTARawAlert): CTAAlert {
  const fullDescription =
    typeof raw.FullDescription === 'object'
      ? raw.FullDescription['#cdata-section'] || ''
      : String(raw.FullDescription || '');

  const alertUrl =
    typeof raw.AlertURL === 'object'
      ? raw.AlertURL['#cdata-section']
      : raw.AlertURL;

  // Handle services array or single service
  let services: AffectedService[] = [];
  if (raw.ImpactedService?.Service) {
    const rawServices = Array.isArray(raw.ImpactedService.Service)
      ? raw.ImpactedService.Service
      : [raw.ImpactedService.Service];
    services = rawServices.map(transformService);
  }

  return {
    id: raw.GUID,
    alertId: raw.AlertId,
    headline: raw.Headline,
    shortDescription: raw.ShortDescription,
    fullDescription: fullDescription
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim(),
    severity: mapSeverity(raw.SeverityScore),
    impact: mapImpact(raw.Impact),
    category: determineCategory(raw.Headline, raw.ShortDescription),
    affectedServices: services,
    eventStart: raw.EventStart,
    eventEnd: raw.EventEnd,
    tbd: raw.TBD === '1',
    majorAlert: raw.MajorAlert === '1',
    updatedAt: raw.ttim || raw.EventStart,
    url: alertUrl,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routesParam = searchParams.get('routes');
  const activeOnly = searchParams.get('activeOnly') !== 'false';

  try {
    // Build CTA API URL
    const url = new URL(CTA_ALERTS_API);
    url.searchParams.set('outputType', 'JSON');
    if (routesParam) {
      url.searchParams.set('routeid', routesParam);
    }
    if (activeOnly) {
      url.searchParams.set('activeonly', 'true');
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      throw new Error(`CTA API returned ${response.status}`);
    }

    const data: CTAAlertResponse = await response.json();

    if (data.CTAAlerts.ErrorCode !== '0') {
      console.error('CTA Alerts API error:', data.CTAAlerts.ErrorMessage);
      // Return empty response instead of error for no alerts
      if (data.CTAAlerts.ErrorCode === '100') {
        return NextResponse.json({
          alerts: [],
          summary: {
            total: 0,
            byType: {},
            bySeverity: {},
          },
          lastUpdated: new Date().toISOString(),
        });
      }
      throw new Error(data.CTAAlerts.ErrorMessage || 'Unknown CTA API error');
    }

    // Transform alerts
    const rawAlerts = data.CTAAlerts.Alert || [];
    const alerts: CTAAlert[] = rawAlerts.map(transformAlert);

    // Sort by severity (critical first) then by date
    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.eventStart).getTime() - new Date(a.eventStart).getTime();
    });

    // Build summary
    const byType: Partial<Record<AlertCategory, number>> = {};
    const bySeverity: Partial<Record<AlertSeverity, number>> = {};

    alerts.forEach((alert) => {
      byType[alert.category] = (byType[alert.category] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    });

    const response_data: AlertsResponse = {
      alerts,
      summary: {
        total: alerts.length,
        byType,
        bySeverity,
      },
      lastUpdated: data.CTAAlerts.TimeStamp || new Date().toISOString(),
    };

    return NextResponse.json(response_data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Error fetching CTA alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service alerts' },
      { status: 500 }
    );
  }
}
