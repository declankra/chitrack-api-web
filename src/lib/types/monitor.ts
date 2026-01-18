/**
 * Monitor Page Types
 * Type definitions for the command center monitor dashboard
 */

import type { RouteColor, Arrival, Station, StationStop } from './cta';

// ============================================
// Core Status Types
// ============================================

export type SystemHealthStatus = 'nominal' | 'degraded' | 'critical';
export type ServiceStatus = 'operational' | 'disrupted' | 'down';
export type AlertSeverity = 'info' | 'minor' | 'major' | 'critical';

// ============================================
// Weather Types
// ============================================

export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'overcast'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'snow'
  | 'heavy-snow'
  | 'blizzard'
  | 'fog'
  | 'mist'
  | 'haze'
  | 'windy';

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  conditionDescription: string;
  icon: string;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust?: number;
  windDirection: number;
  windDirectionCardinal: string;
  visibility: number;
  cloudCover: number;
  uvIndex: number;
  dewPoint: number;
  precipitation: {
    probability: number;
    type: 'rain' | 'snow' | 'sleet' | 'none';
    amount: number;
  };
  sunrise: string;
  sunset: string;
}

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  urgency: 'immediate' | 'expected' | 'future' | 'past' | 'unknown';
  certainty: 'observed' | 'likely' | 'possible' | 'unlikely' | 'unknown';
  start: string;
  end: string;
  senderName: string;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  condition: WeatherCondition;
  icon: string;
  precipProbability: number;
  windSpeed: number;
}

// ============================================
// CTA Alert Types
// ============================================

export type AlertCategory =
  | 'planned-work'
  | 'service-change'
  | 'delay'
  | 'emergency'
  | 'accessibility'
  | 'information';

export type AlertImpact =
  | 'normal'
  | 'delays'
  | 'reroute'
  | 'reduced-service'
  | 'suspended'
  | 'advisory';

export interface CTAAlert {
  id: string;
  alertId: string;
  headline: string;
  shortDescription: string;
  fullDescription: string;
  severity: AlertSeverity;
  impact: AlertImpact;
  category: AlertCategory;
  affectedServices: AffectedService[];
  eventStart: string;
  eventEnd?: string;
  tbd: boolean;
  majorAlert: boolean;
  updatedAt: string;
  url?: string;
}

export interface AffectedService {
  type: 'train' | 'bus';
  routeId: string;
  routeName: string;
  routeColor?: string;
  stationIds?: string[];
  stopIds?: string[];
  direction?: string;
}

// ============================================
// Live Vehicle Types
// ============================================

export interface LiveTrain {
  runNumber: string;
  route: RouteColor;
  routeName: string;
  destinationId: string;
  destinationName: string;
  nextStationId: string;
  nextStationName: string;
  arrivalTime: string;
  isApproaching: boolean;
  isScheduled: boolean;
  isDelayed: boolean;
  lat: number;
  lon: number;
  heading: number;
  flags?: string;
}

export interface LiveBus {
  vehicleId: string;
  routeId: string;
  routeName: string;
  destination: string;
  lat: number;
  lon: number;
  heading: number;
  patternId: string;
  patternDistance: number;
  isDelayed: boolean;
  timestamp: string;
}

// ============================================
// Analytics Types
// ============================================

export type DelayReason =
  | 'signal-problem'
  | 'track-issue'
  | 'mechanical'
  | 'medical-emergency'
  | 'police-activity'
  | 'weather'
  | 'congestion'
  | 'door-problem'
  | 'switch-problem'
  | 'debris-on-track'
  | 'unknown';

export interface DelayIncident {
  id: string;
  route: RouteColor;
  stationId: string;
  stationName: string;
  reason: DelayReason;
  estimatedDuration: number;
  actualDuration?: number;
  startTime: string;
  endTime?: string;
  affectedTrains: number;
  resolved: boolean;
}

export interface LinePerformance {
  route: RouteColor;
  onTimePerformance: number;
  averageHeadway: number;
  scheduledHeadway: number;
  headwayDeviation: number;
  activeTrains: number;
  scheduledTrains: number;
  delayedTrains: number;
  avgDelayMinutes: number;
  ridership?: {
    current: number;
    capacity: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
}

export interface DelayHotspot {
  stationId: string;
  stationName: string;
  lines: RouteColor[];
  delaysPerHour: number;
  avgDelayDuration: number;
  primaryReason: DelayReason;
  recentIncidents: number;
}

export interface DelayAnalytics {
  timeRange: '1h' | '4h' | '24h' | '7d';
  timestamp: string;
  overall: {
    currentDelayRate: number;
    baselineDelayRate: number;
    deviation: number;
    trend: 'improving' | 'stable' | 'worsening';
    totalDelayedTrains: number;
    avgDelayMinutes: number;
  };
  byLine: Record<RouteColor, LinePerformance>;
  hotspots: DelayHotspot[];
  incidents: DelayIncident[];
  timeline: {
    timestamp: string;
    delayRate: number;
    incidentCount: number;
  }[];
  delayReasons: {
    reason: DelayReason;
    count: number;
    percentage: number;
  }[];
}

// ============================================
// Social Feed Types
// ============================================

export type SocialPlatform = 'twitter' | 'reddit' | 'mastodon' | 'rss';
export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface SocialAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  isOfficial: boolean;
  platform: SocialPlatform;
}

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  author: SocialAuthor;
  content: string;
  contentHtml?: string;
  timestamp: string;
  url: string;
  engagement: {
    likes: number;
    reposts: number;
    replies: number;
  };
  sentiment: Sentiment;
  mentionedRoutes: string[];
  mentionedStations: string[];
  hashtags: string[];
  mediaUrls?: string[];
  inReplyToId?: string;
  isRetweet: boolean;
}

export interface SocialFeedData {
  posts: SocialPost[];
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  trending: {
    hashtag: string;
    count: number;
  }[];
  volume: {
    current: number;
    hourlyAverage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
}

// ============================================
// System Status Types
// ============================================

export interface LineStatus {
  route: RouteColor;
  routeName: string;
  status: ServiceStatus;
  onTimePerformance: number;
  activeTrains: number;
  scheduledTrains: number;
  delayedTrains: number;
  avgHeadway: number;
  alerts: number;
  lastIncident?: {
    type: DelayReason;
    time: string;
    resolved: boolean;
  };
}

export interface SystemStatus {
  overall: SystemHealthStatus;
  timestamp: string;
  trains: {
    status: ServiceStatus;
    activeCount: number;
    scheduledCount: number;
    delayedCount: number;
    onTimePerformance: number;
  };
  buses: {
    status: ServiceStatus;
    activeCount: number;
    delayedCount: number;
  };
  alerts: {
    total: number;
    critical: number;
    major: number;
    minor: number;
  };
  lines: Partial<Record<RouteColor, LineStatus>>;
  dataFreshness: {
    trains: string;
    buses: string;
    alerts: string;
    weather: string;
  };
}

// ============================================
// Map Layer Types
// ============================================

export interface MapLayerConfig {
  trains: boolean;
  buses: boolean;
  stations: boolean;
  alerts: boolean;
  weather: boolean;
  heatmap: boolean;
}

export interface MapFilter {
  routes: RouteColor[];
  showDelayedOnly: boolean;
  showBuses: boolean;
  showAccessibleOnly: boolean;
}

// ============================================
// Drill-Down Types
// ============================================

export interface StationDetail {
  stationId: string;
  stationName: string;
  lines: RouteColor[];
  location: {
    lat: number;
    lon: number;
    address?: string;
  };
  accessibility: {
    wheelchairAccessible: boolean;
    elevators: {
      id: string;
      status: 'operational' | 'outage';
      description?: string;
    }[];
  };
  stops: {
    stopId: string;
    stopName: string;
    direction: string;
    route: RouteColor;
    arrivals: Arrival[];
  }[];
  recentPerformance: {
    avgDelay: number;
    delayRate: number;
    peakHours: string[];
  };
  alerts: CTAAlert[];
  nearbyBusStops: {
    stopId: string;
    stopName: string;
    routes: string[];
    distance: number;
  }[];
}

export interface RouteDetail {
  route: RouteColor;
  routeName: string;
  description: string;
  status: ServiceStatus;
  terminals: {
    north: string;
    south: string;
  };
  activeTrains: LiveTrain[];
  stations: {
    stationId: string;
    stationName: string;
    stopId: string;
    sequence: number;
    arrivals: Arrival[];
  }[];
  performance: LinePerformance;
  alerts: CTAAlert[];
  schedule: {
    firstTrain: string;
    lastTrain: string;
    peakHeadway: number;
    offPeakHeadway: number;
  };
}

// ============================================
// Monitor State Types
// ============================================

export interface MonitorState {
  // UI state
  sidebarCollapsed: boolean;
  activePanel: 'weather' | 'alerts' | 'social' | 'analytics' | null;

  // Map state
  mapLayers: MapLayerConfig;
  mapFilters: MapFilter;
  mapCenter: [number, number];
  mapZoom: number;

  // Selection state
  selectedStation: string | null;
  selectedRoute: RouteColor | null;
  selectedTrain: string | null;

  // Drill-down state
  drillDownType: 'station' | 'route' | 'train' | null;
  drillDownId: string | null;

  // Data refresh
  autoRefresh: boolean;
  refreshInterval: number;
  lastRefresh: Record<string, Date>;
}

// ============================================
// API Response Types
// ============================================

export interface WeatherResponse {
  current: WeatherData;
  forecast: HourlyForecast[];
  alerts: WeatherAlert[];
  lastUpdated: string;
}

export interface AlertsResponse {
  alerts: CTAAlert[];
  summary: {
    total: number;
    byType: Partial<Record<AlertCategory, number>>;
    bySeverity: Partial<Record<AlertSeverity, number>>;
  };
  lastUpdated: string;
}

export interface TrainPositionsResponse {
  trains: LiveTrain[];
  timestamp: string;
  count: number;
}

export interface SystemStatusResponse extends SystemStatus {}

// ============================================
// Re-export types from cta.ts
// ============================================

export type { RouteColor, Arrival, Station, StationStop };
