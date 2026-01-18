# ChiTrack Monitor Page - Technical Specification

## Overview

The Monitor page is a data-intensive, command-center style dashboard for real-time CTA system monitoring. It provides a comprehensive view of Chicago's transit system including weather conditions, service alerts, delay analytics, social media sentiment, and live train/bus tracking.

**Route:** `/monitor`

**Design Philosophy:** Futuristic command center with dark mode aesthetics. Think NASA mission control meets Bloomberg Terminal meets cyberpunk.

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Page Architecture](#2-page-architecture)
3. [Core Components](#3-core-components)
4. [Data Panels](#4-data-panels)
5. [Map Layer System](#5-map-layer-system)
6. [API Routes](#6-api-routes)
7. [Data Models](#7-data-models)
8. [State Management](#8-state-management)
9. [Real-time Data Flow](#9-real-time-data-flow)
10. [Drill-Down Views](#10-drill-down-views)
11. [Implementation Phases](#11-implementation-phases)
12. [File Structure](#12-file-structure)

---

## 1. Design System

### 1.1 Color Palette (Command Center Dark Theme)

```css
:root {
  /* Base colors */
  --monitor-bg-primary: #0a0a0f;        /* Near black with blue tint */
  --monitor-bg-secondary: #12121a;       /* Card backgrounds */
  --monitor-bg-tertiary: #1a1a24;        /* Elevated surfaces */
  --monitor-bg-hover: #22222e;           /* Hover states */

  /* Border & Dividers */
  --monitor-border: #2a2a3a;             /* Subtle borders */
  --monitor-border-glow: #3a3a5a;        /* Active/focused borders */

  /* Text hierarchy */
  --monitor-text-primary: #f0f0f5;       /* Primary text */
  --monitor-text-secondary: #a0a0b0;     /* Secondary text */
  --monitor-text-muted: #606070;         /* Muted/disabled */

  /* Accent colors (neon-inspired) */
  --monitor-accent-cyan: #00d4ff;        /* Primary accent */
  --monitor-accent-green: #00ff88;       /* Success/positive */
  --monitor-accent-amber: #ffaa00;       /* Warning */
  --monitor-accent-red: #ff4466;         /* Error/critical */
  --monitor-accent-purple: #aa66ff;      /* Highlight/special */

  /* CTA Line colors (slightly brightened for dark mode) */
  --cta-red: #c60c30;
  --cta-blue: #00a1de;
  --cta-brown: #62361b;
  --cta-green: #009b3a;
  --cta-orange: #f9461c;
  --cta-purple: #522398;
  --cta-pink: #e27ea6;
  --cta-yellow: #f9e300;

  /* Status indicators */
  --status-nominal: #00ff88;
  --status-degraded: #ffaa00;
  --status-critical: #ff4466;
  --status-unknown: #606070;

  /* Glow effects */
  --glow-cyan: 0 0 20px rgba(0, 212, 255, 0.3);
  --glow-green: 0 0 20px rgba(0, 255, 136, 0.3);
  --glow-red: 0 0 20px rgba(255, 68, 102, 0.3);
}
```

### 1.2 Typography

```css
/* Monospace for data displays */
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;

/* Sans-serif for labels */
--font-sans: 'Inter', -apple-system, sans-serif;

/* Font sizes */
--text-xs: 0.625rem;    /* 10px - timestamps, micro labels */
--text-sm: 0.75rem;     /* 12px - secondary data */
--text-base: 0.875rem;  /* 14px - primary data */
--text-lg: 1rem;        /* 16px - headers */
--text-xl: 1.25rem;     /* 20px - section titles */
--text-2xl: 1.5rem;     /* 24px - major metrics */
--text-3xl: 2rem;       /* 32px - hero numbers */
```

### 1.3 Visual Effects

```css
/* Scanline overlay (subtle) */
.scanlines::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  pointer-events: none;
}

/* Grid pattern background */
.grid-pattern {
  background-image:
    linear-gradient(rgba(42, 42, 58, 0.5) 1px, transparent 1px),
    linear-gradient(90deg, rgba(42, 42, 58, 0.5) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* Glowing border effect */
.glow-border {
  box-shadow:
    0 0 0 1px var(--monitor-border),
    0 0 20px -5px var(--monitor-accent-cyan);
}

/* Pulse animation for live indicators */
@keyframes pulse-glow {
  0%, 100% { opacity: 1; box-shadow: 0 0 5px currentColor; }
  50% { opacity: 0.6; box-shadow: 0 0 15px currentColor; }
}
```

### 1.4 Component Styling Patterns

**Cards/Panels:**
```css
.monitor-panel {
  background: var(--monitor-bg-secondary);
  border: 1px solid var(--monitor-border);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.monitor-panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--monitor-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.monitor-panel-title {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--monitor-text-secondary);
}
```

---

## 2. Page Architecture

### 2.1 Layout Structure

The Monitor page uses a **full-viewport** layout that breaks out of the iPhone mockup used by other pages. It's designed for desktop-first but responsive down to tablet.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER BAR (56px)                                                           │
│ ┌─────────────┬─────────────────────────────────────────────────┬─────────┐ │
│ │ CHITRACK    │ System Status: ● NOMINAL   Last Update: 12:34:56│ [≡] [⚙] │ │
│ │ MONITOR     │                                                  │         │ │
│ └─────────────┴─────────────────────────────────────────────────┴─────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ MAIN CONTENT AREA                                                           │
│ ┌────────────────────────────────────────────────────────────┬────────────┐ │
│ │                                                            │ RIGHT      │ │
│ │                                                            │ SIDEBAR    │ │
│ │                                                            │ (320px)    │ │
│ │                    MAP VIEWPORT                            │            │ │
│ │                    (flex-grow)                             │ - Weather  │ │
│ │                                                            │ - Alerts   │ │
│ │                                                            │ - Social   │ │
│ │                                                            │ - Stats    │ │
│ │                                                            │            │ │
│ │ ┌──────────────────────────────────────────────────────┐   │            │ │
│ │ │ BOTTOM TICKER / STATS BAR (48px)                     │   │            │ │
│ │ │ Red: 98.2% │ Blue: 94.1% │ Brown: 99.1% │ ...        │   │            │ │
│ │ └──────────────────────────────────────────────────────┘   │            │ │
│ └────────────────────────────────────────────────────────────┴────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `≥1440px` | Full layout with all panels visible |
| `1024-1439px` | Collapsible sidebar, overlay panels |
| `768-1023px` | Bottom sheet panels, smaller map |
| `<768px` | Mobile: Stacked layout, swipeable panels |

### 2.3 Component Hierarchy

```
MonitorPage
├── MonitorHeader
│   ├── Logo + Title
│   ├── SystemStatusIndicator
│   ├── LastUpdateTimestamp
│   └── HeaderActions (Menu, Settings)
├── MonitorLayout
│   ├── MapViewport
│   │   ├── MonitorMapComponent
│   │   │   ├── TrainMarkers
│   │   │   ├── BusMarkers
│   │   │   ├── StationMarkers
│   │   │   ├── AlertOverlays
│   │   │   └── WeatherOverlay
│   │   ├── MapControls
│   │   │   ├── LayerToggle
│   │   │   ├── ZoomControls
│   │   │   └── LocateButton
│   │   └── BottomTicker
│   │       └── LineStatusCards
│   └── RightSidebar
│       ├── WeatherPanel
│       ├── AlertsPanel
│       ├── SocialFeedPanel
│       └── DelayAnalyticsPanel
└── DrillDownModal (conditional)
    ├── StationDetailView
    └── RouteDetailView
```

---

## 3. Core Components

### 3.1 MonitorHeader

**File:** `src/components/monitor/MonitorHeader.tsx`

```typescript
interface MonitorHeaderProps {
  systemStatus: 'nominal' | 'degraded' | 'critical';
  lastUpdate: Date;
  onMenuClick: () => void;
  onSettingsClick: () => void;
}
```

**Features:**
- Logo with subtle glow animation
- System-wide status indicator (aggregates all line statuses)
- Real-time clock with last data update timestamp
- Hamburger menu for mobile navigation
- Settings gear for panel customization

**Visual:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ ◈ CHITRACK MONITOR          ● NOMINAL   ⟳ Updated 12:34:56    ≡  ⚙  │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 SystemStatusIndicator

**File:** `src/components/monitor/SystemStatusIndicator.tsx`

```typescript
interface SystemStatus {
  overall: 'nominal' | 'degraded' | 'critical';
  trainSystem: 'operational' | 'disrupted' | 'down';
  busSystem: 'operational' | 'disrupted' | 'down';
  activeAlerts: number;
  delayedLines: string[];
}

const StatusBadge: React.FC<{ status: SystemStatus }> = ({ status }) => {
  const statusConfig = {
    nominal: { color: 'green', label: 'NOMINAL', icon: CheckCircle },
    degraded: { color: 'amber', label: 'DEGRADED', icon: AlertTriangle },
    critical: { color: 'red', label: 'CRITICAL', icon: XCircle },
  };
  // ...
};
```

### 3.3 BottomTicker

**File:** `src/components/monitor/BottomTicker.tsx`

A horizontally scrolling (or static grid) display showing real-time performance metrics for each CTA line.

```typescript
interface LineStatus {
  line: RouteColor;
  onTimePerformance: number;      // Percentage (0-100)
  activeTrains: number;
  avgHeadway: number;             // Minutes
  delayedTrains: number;
  status: 'normal' | 'delayed' | 'suspended';
}

interface BottomTickerProps {
  lineStatuses: LineStatus[];
  onLineClick: (line: RouteColor) => void;
}
```

**Visual:**
```
┌────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│ ● RED  │ ● BLUE │ ● BRN  │ ● GRN  │ ● ORG  │ ● PRP  │ ● PINK │ ● YEL  │
│ 98.2%  │ 94.1%  │ 99.1%  │ 97.3%  │ 95.8%  │ 100%   │ 98.9%  │ 100%   │
│ 24 trn │ 31 trn │ 18 trn │ 22 trn │ 19 trn │ 8 trn  │ 12 trn │ 6 trn  │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
```

---

## 4. Data Panels

### 4.1 WeatherPanel

**File:** `src/components/monitor/panels/WeatherPanel.tsx`

Real-time Chicago weather data with transit-relevant information.

```typescript
interface WeatherData {
  temperature: number;          // Fahrenheit
  feelsLike: number;
  condition: WeatherCondition;
  icon: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  visibility: number;           // Miles
  precipitation: {
    probability: number;
    type: 'rain' | 'snow' | 'sleet' | 'none';
    amount: number;             // Inches expected
  };
  alerts: WeatherAlert[];
  sunrise: string;
  sunset: string;
  uvIndex: number;
}

interface WeatherAlert {
  id: string;
  type: 'warning' | 'watch' | 'advisory';
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  expires: Date;
}

type WeatherCondition =
  | 'clear' | 'partly-cloudy' | 'cloudy' | 'overcast'
  | 'rain' | 'heavy-rain' | 'thunderstorm'
  | 'snow' | 'heavy-snow' | 'blizzard'
  | 'fog' | 'mist' | 'haze';
```

**Visual Design:**
```
┌─────────────────────────────────┐
│ WEATHER          Chicago, IL   │
├─────────────────────────────────┤
│                                 │
│   ☀️   72°F                     │
│        Feels like 75°F          │
│        Clear                    │
│                                 │
│  💨 12 mph NW   💧 45%          │
│  👁 10 mi       ☔ 0%           │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ⚠ HEAT ADVISORY            │ │
│ │ Until 8:00 PM CDT           │ │
│ └─────────────────────────────┘ │
│                                 │
│  🌅 5:23 AM    🌇 8:14 PM       │
└─────────────────────────────────┘
```

### 4.2 AlertsPanel

**File:** `src/components/monitor/panels/AlertsPanel.tsx`

Live CTA service alerts with filtering and priority sorting.

```typescript
interface CTAAlert {
  id: string;
  headline: string;
  shortDescription: string;
  fullDescription: string;
  severity: 'info' | 'minor' | 'major' | 'critical';
  impact: AlertImpact;
  affectedServices: {
    type: 'train' | 'bus';
    routes: string[];
    stations?: string[];
    stops?: string[];
  }[];
  startTime: Date;
  endTime?: Date;
  updatedAt: Date;
  category: AlertCategory;
}

type AlertImpact =
  | 'delays'
  | 'reroute'
  | 'reduced-service'
  | 'suspended'
  | 'advisory';

type AlertCategory =
  | 'planned-work'
  | 'service-change'
  | 'delay'
  | 'emergency'
  | 'accessibility'
  | 'information';
```

**Visual Design:**
```
┌─────────────────────────────────┐
│ SERVICE ALERTS           [⟳] 12│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🔴 RED LINE                 │ │
│ │ Delays - Signal Problem     │ │
│ │ 15-20 min delays near       │ │
│ │ Fullerton. Crews on scene.  │ │
│ │ Updated 2 min ago           │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🟠 ORANGE LINE              │ │
│ │ Planned Work - Weekend      │ │
│ │ No service Midway-Pulaski   │ │
│ │ Sat-Sun 10pm-5am            │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🚌 BUS #66                  │ │
│ │ Reroute - Construction      │ │
│ │ Via Western instead of...   │ │
│ └─────────────────────────────┘ │
│                                 │
│ [View All 12 Alerts →]          │
└─────────────────────────────────┘
```

### 4.3 SocialFeedPanel

**File:** `src/components/monitor/panels/SocialFeedPanel.tsx`

Aggregated social media mentions about CTA from Twitter/X and other sources.

```typescript
interface SocialPost {
  id: string;
  platform: 'twitter' | 'reddit' | 'mastodon';
  author: {
    username: string;
    displayName: string;
    avatarUrl?: string;
    verified: boolean;
    isOfficial: boolean;    // CTA official accounts
  };
  content: string;
  timestamp: Date;
  engagement: {
    likes: number;
    reposts: number;
    replies: number;
  };
  sentiment: 'positive' | 'negative' | 'neutral';
  mentionedRoutes: string[];
  mentionedStations: string[];
  mediaUrls?: string[];
  url: string;
}

interface SocialFeedFilters {
  platforms: ('twitter' | 'reddit' | 'mastodon')[];
  sentiment: ('positive' | 'negative' | 'neutral')[];
  officialOnly: boolean;
  routes: string[];
}
```

**Visual Design:**
```
┌─────────────────────────────────┐
│ SOCIAL FEED     [Filter ▾] Live│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ ✓ @caborinc  • 2m           │ │
│ │ CTA Red Line                │ │
│ │ Major delays on the Red     │ │
│ │ Line northbound. Been       │ │
│ │ stuck at Fullerton for 15   │ │
│ │ minutes now. 😤             │ │
│ │ ❤️ 24  🔄 8  💬 3  [−]      │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ✓ @caborinc Official  • 5m  │ │
│ │ We're aware of delays on    │ │
│ │ the Red Line due to signal  │ │
│ │ problems. Crews working to  │ │
│ │ restore normal service.     │ │
│ │ ❤️ 156  🔄 89  💬 42  [+]   │ │
│ └─────────────────────────────┘ │
│                                 │
│ Sentiment: 😊 12% 😐 34% 😠 54% │
│ [Load More]                     │
└─────────────────────────────────┘
```

### 4.4 DelayAnalyticsPanel

**File:** `src/components/monitor/panels/DelayAnalyticsPanel.tsx`

Historical and real-time delay analytics comparing current performance to baseline.

```typescript
interface DelayAnalytics {
  timeRange: '1h' | '4h' | '24h' | '7d';
  overall: {
    currentDelayRate: number;       // Percentage of delayed trains
    baselineDelayRate: number;      // Historical average for this time
    deviation: number;              // +/- percentage points
    trend: 'improving' | 'stable' | 'worsening';
  };
  byLine: {
    [K in RouteColor]: {
      currentDelayRate: number;
      baselineDelayRate: number;
      avgDelayMinutes: number;
      totalDelayedTrains: number;
      delayReasons: {
        reason: DelayReason;
        count: number;
        percentage: number;
      }[];
    };
  };
  hotspots: {
    stationId: string;
    stationName: string;
    line: RouteColor;
    delayFrequency: number;         // Delays per hour
    avgDelayDuration: number;       // Minutes
  }[];
  timeline: {
    timestamp: Date;
    delayRate: number;
    incidents: number;
  }[];
}

type DelayReason =
  | 'signal-problem'
  | 'track-issue'
  | 'mechanical'
  | 'medical-emergency'
  | 'police-activity'
  | 'weather'
  | 'congestion'
  | 'unknown';
```

**Visual Design:**
```
┌─────────────────────────────────┐
│ DELAY ANALYTICS    [1h▾] [📊]  │
├─────────────────────────────────┤
│                                 │
│  Current Delay Rate             │
│  ████████████░░░░  12.4%        │
│  Baseline: 8.2%  (+4.2%)  ↗     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [Mini sparkline chart]      │ │
│ │ Last 1 hour trend           │ │
│ └─────────────────────────────┘ │
│                                 │
│  DELAY HOTSPOTS                 │
│  1. 🔴 Fullerton    4.2/hr     │
│  2. 🔵 O'Hare       2.8/hr     │
│  3. 🟤 Belmont      2.1/hr     │
│                                 │
│  TOP REASONS                    │
│  ● Signal Problems     45%     │
│  ● Congestion          28%     │
│  ● Medical             15%     │
│  ● Other               12%     │
│                                 │
│ [View Full Analytics →]         │
└─────────────────────────────────┘
```

---

## 5. Map Layer System

### 5.1 MonitorMapComponent

**File:** `src/components/monitor/MonitorMapComponent.tsx`

An enhanced version of the existing MapComponent with additional layers for the command center view.

```typescript
interface MonitorMapProps {
  // Layer visibility
  layers: {
    trains: boolean;
    buses: boolean;
    stations: boolean;
    alerts: boolean;
    weather: boolean;
    heatmap: boolean;
  };
  // Selection callbacks
  onStationSelect: (stationId: string) => void;
  onTrainSelect: (runNumber: string) => void;
  onBusSelect: (vehicleId: string) => void;
  onRouteSelect: (route: RouteColor) => void;
  // Filters
  activeRoutes: RouteColor[];
  showDelayedOnly: boolean;
}
```

### 5.2 Map Layers

#### 5.2.1 Live Train Markers

Real-time train positions with direction indicators.

```typescript
interface LiveTrain {
  runNumber: string;
  route: RouteColor;
  destination: string;
  nextStation: string;
  lat: number;
  lon: number;
  heading: number;          // Degrees for rotation
  isApproaching: boolean;
  isDelayed: boolean;
  arrivalTime: Date;
}
```

**Visual:** Small train icons colored by line, with:
- Direction arrow showing heading
- Pulse effect when approaching station
- Warning indicator when delayed
- Tooltip with run number and destination

#### 5.2.2 Live Bus Markers

Real-time bus positions.

```typescript
interface LiveBus {
  vehicleId: string;
  routeId: string;
  routeName: string;
  destination: string;
  lat: number;
  lon: number;
  heading: number;
  isDelayed: boolean;
  passengers?: number;      // If available
}
```

**Visual:** Bus icons with route number badges.

#### 5.2.3 Station Markers

Enhanced station markers showing status.

```typescript
interface StationMarker {
  stationId: string;
  stationName: string;
  lat: number;
  lon: number;
  lines: RouteColor[];
  status: 'normal' | 'delays' | 'closed';
  hasAlert: boolean;
  accessibility: boolean;
}
```

**Visual:**
- Circle with line color(s)
- Pulsing ring for active alerts
- Dimmed for closed stations
- Wheelchair icon for accessible

#### 5.2.4 Alert Overlay

Visual indicators for affected areas.

```typescript
interface AlertOverlay {
  alertId: string;
  type: 'line-segment' | 'station' | 'area';
  geometry: GeoJSON.Geometry;
  severity: 'minor' | 'major' | 'critical';
}
```

**Visual:**
- Highlighted line segments in warning colors
- Affected stations with alert badges
- Animated dashed lines for reroutes

#### 5.2.5 Weather Overlay

Optional weather radar/conditions layer.

```typescript
interface WeatherOverlay {
  enabled: boolean;
  type: 'radar' | 'temperature' | 'precipitation';
  opacity: number;
}
```

**Visual:** Semi-transparent overlay showing weather patterns.

#### 5.2.6 Delay Heatmap

Visual density of delays across the system.

```typescript
interface DelayHeatmapConfig {
  enabled: boolean;
  intensity: number;
  radius: number;
  dataSource: 'realtime' | '1h' | '24h';
}
```

**Visual:** Heat gradient showing areas of frequent delays.

### 5.3 Map Controls

**File:** `src/components/monitor/MapControls.tsx`

```typescript
interface MapControlsProps {
  layers: LayerConfig;
  onLayerToggle: (layer: string, enabled: boolean) => void;
  activeRoutes: RouteColor[];
  onRouteFilter: (routes: RouteColor[]) => void;
  mapStyle: 'dark' | 'satellite' | 'terrain';
  onStyleChange: (style: string) => void;
}
```

**Features:**
- Layer toggle checkboxes
- Route filter chips
- Map style selector
- Zoom controls
- Fullscreen toggle
- Screenshot/export

---

## 6. API Routes

### 6.1 New API Endpoints

#### 6.1.1 Weather API

**Endpoint:** `GET /api/monitor/weather`

**External API:** OpenWeatherMap or Weather.gov

```typescript
// Request
// No params needed (defaults to Chicago coordinates)

// Response
interface WeatherResponse {
  current: WeatherData;
  forecast: HourlyForecast[];
  alerts: WeatherAlert[];
  lastUpdated: string;
}
```

**Implementation:** `src/app/api/monitor/weather/route.ts`

```typescript
import { NextResponse } from 'next/server';

const CHICAGO_LAT = 41.8781;
const CHICAGO_LON = -87.6298;

export async function GET() {
  try {
    // Option 1: OpenWeatherMap (requires API key)
    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${CHICAGO_LAT}&lon=${CHICAGO_LON}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`
    );

    // Option 2: Weather.gov (free, no key needed)
    // const pointsResponse = await fetch(
    //   `https://api.weather.gov/points/${CHICAGO_LAT},${CHICAGO_LON}`
    // );

    const data = await response.json();

    return NextResponse.json({
      current: transformWeatherData(data.current),
      forecast: data.hourly.slice(0, 24).map(transformHourlyData),
      alerts: data.alerts?.map(transformAlert) || [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
```

**Caching:** 10 minutes (weather doesn't change rapidly)

#### 6.1.2 CTA Alerts API

**Endpoint:** `GET /api/monitor/alerts`

**External API:** CTA Customer Alerts API

```typescript
// Request
interface AlertsRequest {
  routes?: string;          // Comma-separated route codes
  activeOnly?: boolean;     // Default true
}

// Response
interface AlertsResponse {
  alerts: CTAAlert[];
  summary: {
    total: number;
    byType: Record<AlertCategory, number>;
    bySeverity: Record<string, number>;
  };
  lastUpdated: string;
}
```

**Implementation:** `src/app/api/monitor/alerts/route.ts`

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routes = searchParams.get('routes');

  // CTA Customer Alerts API
  const url = new URL('http://www.transitchicago.com/api/1.0/alerts.aspx');
  url.searchParams.set('outputType', 'JSON');
  if (routes) url.searchParams.set('routeid', routes);

  const response = await fetch(url.toString());
  const data = await response.json();

  const alerts = data.CTAAlerts?.Alert?.map(transformCTAAlert) || [];

  return NextResponse.json({
    alerts,
    summary: generateAlertSummary(alerts),
    lastUpdated: new Date().toISOString(),
  });
}
```

**Caching:** 60 seconds

#### 6.1.3 Live Train Positions API

**Endpoint:** `GET /api/monitor/trains/positions`

**External API:** CTA Train Tracker API (ttpositions endpoint)

```typescript
// Request
interface TrainPositionsRequest {
  routes?: string;          // Filter by route(s)
}

// Response
interface TrainPositionsResponse {
  trains: LiveTrain[];
  timestamp: string;
  count: number;
}
```

**Implementation:** `src/app/api/monitor/trains/positions/route.ts`

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routes = searchParams.get('routes')?.split(',') || ['red', 'blue', 'brn', 'g', 'org', 'p', 'pink', 'y'];

  // Fetch positions for each route (CTA requires separate calls)
  const positions = await Promise.all(
    routes.map(async (route) => {
      const response = await fetch(
        `https://lapi.transitchicago.com/api/1.0/ttpositions.aspx?key=${process.env.CTA_TRAIN_API_KEY}&rt=${route}&outputType=JSON`
      );
      const data = await response.json();
      return data.ctatt?.route?.[0]?.train || [];
    })
  );

  const allTrains = positions.flat().map(transformTrainPosition);

  return NextResponse.json({
    trains: allTrains,
    timestamp: new Date().toISOString(),
    count: allTrains.length,
  });
}
```

**Caching:** 15 seconds (real-time data)

#### 6.1.4 Delay Analytics API

**Endpoint:** `GET /api/monitor/analytics/delays`

**Data Source:** Computed from historical arrival data (requires database)

```typescript
// Request
interface DelayAnalyticsRequest {
  timeRange: '1h' | '4h' | '24h' | '7d';
  routes?: string;
}

// Response
interface DelayAnalyticsResponse {
  overall: OverallDelayStats;
  byLine: Record<RouteColor, LineDelayStats>;
  hotspots: DelayHotspot[];
  timeline: TimelineDataPoint[];
  lastUpdated: string;
}
```

**Note:** This requires implementing a data collection system that stores arrival predictions and compares them to actual arrivals. Initial implementation can use mock/estimated data.

#### 6.1.5 Social Feed API

**Endpoint:** `GET /api/monitor/social`

**External API:** Twitter API v2 (or alternatives)

```typescript
// Request
interface SocialFeedRequest {
  platforms?: string[];
  limit?: number;           // Default 20
  since?: string;           // ISO timestamp
}

// Response
interface SocialFeedResponse {
  posts: SocialPost[];
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  trending: string[];       // Trending topics/hashtags
  lastUpdated: string;
}
```

**Implementation options:**
1. **Twitter API v2** - Requires API access (paid for high volume)
2. **Reddit API** - For r/chicago, r/ChicagoTransit
3. **RSS feeds** - CTA news feeds
4. **Custom scraping** - With appropriate rate limiting

**Note:** Social media APIs have varying costs and restrictions. Initial implementation may use RSS feeds and/or cached manual updates.

#### 6.1.6 System Status API

**Endpoint:** `GET /api/monitor/status`

**Aggregates data from other endpoints**

```typescript
// Response
interface SystemStatusResponse {
  overall: 'nominal' | 'degraded' | 'critical';
  trains: {
    status: 'operational' | 'disrupted' | 'down';
    activeCount: number;
    delayedCount: number;
  };
  buses: {
    status: 'operational' | 'disrupted' | 'down';
    activeCount: number;
  };
  alerts: {
    total: number;
    critical: number;
    major: number;
  };
  lines: Record<RouteColor, LineStatus>;
  lastUpdated: string;
}
```

### 6.2 API Route Structure

```
src/app/api/
├── monitor/
│   ├── weather/
│   │   └── route.ts
│   ├── alerts/
│   │   └── route.ts
│   ├── trains/
│   │   ├── positions/
│   │   │   └── route.ts
│   │   └── follow/
│   │       └── route.ts         # Follow a specific train
│   ├── analytics/
│   │   ├── delays/
│   │   │   └── route.ts
│   │   └── performance/
│   │       └── route.ts
│   ├── social/
│   │   └── route.ts
│   └── status/
│       └── route.ts
```

---

## 7. Data Models

### 7.1 Type Definitions

**File:** `src/lib/types/monitor.ts`

```typescript
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
  lines: Record<RouteColor, LineStatus>;
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
// Re-export existing types
// ============================================

export type { RouteColor, Arrival, Station, StationStop } from './cta';
```

---

## 8. State Management

### 8.1 Monitor Context

**File:** `src/lib/providers/MonitorProvider.tsx`

```typescript
import { createContext, useContext, useReducer, useCallback } from 'react';

// State shape
interface MonitorState {
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
  drillDownType: 'station' | 'route' | null;
  drillDownId: string | null;

  // Data refresh
  autoRefresh: boolean;
  refreshInterval: number;
  lastRefresh: Record<string, Date>;
}

// Actions
type MonitorAction =
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_ACTIVE_PANEL'; panel: MonitorState['activePanel'] }
  | { type: 'SET_MAP_LAYER'; layer: keyof MapLayerConfig; enabled: boolean }
  | { type: 'SET_MAP_FILTER'; filter: Partial<MapFilter> }
  | { type: 'SELECT_STATION'; stationId: string | null }
  | { type: 'SELECT_ROUTE'; route: RouteColor | null }
  | { type: 'SELECT_TRAIN'; runNumber: string | null }
  | { type: 'OPEN_DRILL_DOWN'; type: 'station' | 'route'; id: string }
  | { type: 'CLOSE_DRILL_DOWN' }
  | { type: 'SET_AUTO_REFRESH'; enabled: boolean }
  | { type: 'UPDATE_LAST_REFRESH'; key: string; time: Date };

// Context
interface MonitorContextValue {
  state: MonitorState;
  dispatch: React.Dispatch<MonitorAction>;

  // Convenience methods
  toggleLayer: (layer: keyof MapLayerConfig) => void;
  filterByRoute: (route: RouteColor) => void;
  clearFilters: () => void;
  openStationDetail: (stationId: string) => void;
  openRouteDetail: (route: RouteColor) => void;
  closeDrillDown: () => void;
}

const MonitorContext = createContext<MonitorContextValue | null>(null);

// Initial state
const initialState: MonitorState = {
  sidebarCollapsed: false,
  activePanel: null,
  mapLayers: {
    trains: true,
    buses: false,
    stations: true,
    alerts: true,
    weather: false,
    heatmap: false,
  },
  mapFilters: {
    routes: [],
    showDelayedOnly: false,
    showBuses: false,
    showAccessibleOnly: false,
  },
  mapCenter: [-87.6298, 41.8781],
  mapZoom: 11,
  selectedStation: null,
  selectedRoute: null,
  selectedTrain: null,
  drillDownType: null,
  drillDownId: null,
  autoRefresh: true,
  refreshInterval: 15000,
  lastRefresh: {},
};

// Reducer
function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.panel };

    case 'SET_MAP_LAYER':
      return {
        ...state,
        mapLayers: { ...state.mapLayers, [action.layer]: action.enabled },
      };

    case 'SET_MAP_FILTER':
      return {
        ...state,
        mapFilters: { ...state.mapFilters, ...action.filter },
      };

    case 'SELECT_STATION':
      return { ...state, selectedStation: action.stationId };

    case 'SELECT_ROUTE':
      return { ...state, selectedRoute: action.route };

    case 'SELECT_TRAIN':
      return { ...state, selectedTrain: action.runNumber };

    case 'OPEN_DRILL_DOWN':
      return {
        ...state,
        drillDownType: action.type,
        drillDownId: action.id,
      };

    case 'CLOSE_DRILL_DOWN':
      return {
        ...state,
        drillDownType: null,
        drillDownId: null,
      };

    case 'SET_AUTO_REFRESH':
      return { ...state, autoRefresh: action.enabled };

    case 'UPDATE_LAST_REFRESH':
      return {
        ...state,
        lastRefresh: { ...state.lastRefresh, [action.key]: action.time },
      };

    default:
      return state;
  }
}

// Provider component
export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(monitorReducer, initialState);

  const toggleLayer = useCallback((layer: keyof MapLayerConfig) => {
    dispatch({ type: 'SET_MAP_LAYER', layer, enabled: !state.mapLayers[layer] });
  }, [state.mapLayers]);

  const filterByRoute = useCallback((route: RouteColor) => {
    const currentRoutes = state.mapFilters.routes;
    const newRoutes = currentRoutes.includes(route)
      ? currentRoutes.filter(r => r !== route)
      : [...currentRoutes, route];
    dispatch({ type: 'SET_MAP_FILTER', filter: { routes: newRoutes } });
  }, [state.mapFilters.routes]);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'SET_MAP_FILTER', filter: { routes: [], showDelayedOnly: false } });
  }, []);

  const openStationDetail = useCallback((stationId: string) => {
    dispatch({ type: 'OPEN_DRILL_DOWN', type: 'station', id: stationId });
  }, []);

  const openRouteDetail = useCallback((route: RouteColor) => {
    dispatch({ type: 'OPEN_DRILL_DOWN', type: 'route', id: route });
  }, []);

  const closeDrillDown = useCallback(() => {
    dispatch({ type: 'CLOSE_DRILL_DOWN' });
  }, []);

  return (
    <MonitorContext.Provider value={{
      state,
      dispatch,
      toggleLayer,
      filterByRoute,
      clearFilters,
      openStationDetail,
      openRouteDetail,
      closeDrillDown,
    }}>
      {children}
    </MonitorContext.Provider>
  );
}

export function useMonitor() {
  const context = useContext(MonitorContext);
  if (!context) {
    throw new Error('useMonitor must be used within MonitorProvider');
  }
  return context;
}
```

### 8.2 Custom Hooks

**File:** `src/lib/hooks/useMonitorData.ts`

```typescript
import { useQuery, useQueries } from '@tanstack/react-query';
import type {
  SystemStatus,
  WeatherData,
  CTAAlert,
  LiveTrain,
  DelayAnalytics,
  SocialFeedData,
} from '@/lib/types/monitor';

// System Status
export function useSystemStatus() {
  return useQuery<SystemStatus>({
    queryKey: ['monitor', 'status'],
    queryFn: async () => {
      const response = await fetch('/api/monitor/status');
      if (!response.ok) throw new Error('Failed to fetch system status');
      return response.json();
    },
    refetchInterval: 15000,
  });
}

// Weather
export function useWeather() {
  return useQuery<{ current: WeatherData; forecast: any[]; alerts: any[] }>({
    queryKey: ['monitor', 'weather'],
    queryFn: async () => {
      const response = await fetch('/api/monitor/weather');
      if (!response.ok) throw new Error('Failed to fetch weather');
      return response.json();
    },
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Alerts
export function useAlerts(routes?: string[]) {
  const routeParam = routes?.join(',') || '';
  return useQuery<{ alerts: CTAAlert[]; summary: any }>({
    queryKey: ['monitor', 'alerts', routeParam],
    queryFn: async () => {
      const url = new URL('/api/monitor/alerts', window.location.origin);
      if (routeParam) url.searchParams.set('routes', routeParam);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    refetchInterval: 60000, // 1 minute
  });
}

// Live Train Positions
export function useTrainPositions(routes?: string[]) {
  const routeParam = routes?.join(',') || '';
  return useQuery<{ trains: LiveTrain[]; count: number }>({
    queryKey: ['monitor', 'trains', 'positions', routeParam],
    queryFn: async () => {
      const url = new URL('/api/monitor/trains/positions', window.location.origin);
      if (routeParam) url.searchParams.set('routes', routeParam);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch train positions');
      return response.json();
    },
    refetchInterval: 15000, // 15 seconds
  });
}

// Delay Analytics
export function useDelayAnalytics(timeRange: '1h' | '4h' | '24h' | '7d' = '1h') {
  return useQuery<DelayAnalytics>({
    queryKey: ['monitor', 'analytics', 'delays', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/monitor/analytics/delays?range=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch delay analytics');
      return response.json();
    },
    refetchInterval: 60000, // 1 minute
    staleTime: 30000, // 30 seconds
  });
}

// Social Feed
export function useSocialFeed(limit: number = 20) {
  return useQuery<SocialFeedData>({
    queryKey: ['monitor', 'social', limit],
    queryFn: async () => {
      const response = await fetch(`/api/monitor/social?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch social feed');
      return response.json();
    },
    refetchInterval: 30000, // 30 seconds
  });
}

// Combined hook for all monitor data
export function useMonitorData() {
  return useQueries({
    queries: [
      {
        queryKey: ['monitor', 'status'],
        queryFn: async () => {
          const response = await fetch('/api/monitor/status');
          return response.json();
        },
        refetchInterval: 15000,
      },
      {
        queryKey: ['monitor', 'weather'],
        queryFn: async () => {
          const response = await fetch('/api/monitor/weather');
          return response.json();
        },
        refetchInterval: 600000,
      },
      {
        queryKey: ['monitor', 'alerts'],
        queryFn: async () => {
          const response = await fetch('/api/monitor/alerts');
          return response.json();
        },
        refetchInterval: 60000,
      },
    ],
  });
}
```

---

## 9. Real-time Data Flow

### 9.1 Data Refresh Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA REFRESH FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │   Weather   │     │   Alerts    │     │   Status    │           │
│  │  10 min     │     │   1 min     │     │   15 sec    │           │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘           │
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┘                   │
│                             │                                       │
│                             ▼                                       │
│                    ┌─────────────────┐                              │
│                    │  React Query    │                              │
│                    │  Query Client   │                              │
│                    └────────┬────────┘                              │
│                             │                                       │
│         ┌───────────────────┼───────────────────┐                   │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │   Train     │     │   Social    │     │  Analytics  │           │
│  │  Positions  │     │    Feed     │     │   Delays    │           │
│  │   15 sec    │     │   30 sec    │     │   1 min     │           │
│  └─────────────┘     └─────────────┘     └─────────────┘           │
│                                                                     │
│  All data flows through React Query for:                            │
│  • Automatic caching                                                │
│  • Background refetching                                            │
│  • Deduplication                                                    │
│  • Optimistic updates                                               │
│  • Error handling                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Refresh Intervals

| Data Source | Interval | Rationale |
|-------------|----------|-----------|
| Train Positions | 15s | Real-time tracking, matches CTA API cache |
| System Status | 15s | Aggregated metrics, quick overview |
| Alerts | 60s | Alerts don't change rapidly |
| Social Feed | 30s | Balance freshness with API limits |
| Weather | 10min | Weather changes slowly |
| Delay Analytics | 60s | Historical data, computed metrics |
| Station Detail | 15s | Real-time arrivals when drilling down |

### 9.3 Stale-While-Revalidate Pattern

```typescript
// Example React Query configuration for monitor data
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,          // Data considered fresh for 10s
      gcTime: 5 * 60 * 1000,     // Cache for 5 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    },
  },
});
```

---

## 10. Drill-Down Views

### 10.1 Station Detail Modal

**File:** `src/components/monitor/drilldown/StationDetailModal.tsx`

When a user clicks on a station, a modal/panel slides in with detailed information.

```typescript
interface StationDetailModalProps {
  stationId: string;
  onClose: () => void;
}
```

**Layout:**
```
┌───────────────────────────────────────────────────────────────┐
│ ← Back                    FULLERTON                     [✕]  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Lines: 🔴 🟤 🟣           ♿ Accessible                       │
│  2500 N Sheffield Ave, Chicago, IL                            │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  ARRIVALS                                        [⟳ Updated]  │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 🔴 Red Line to Howard                                     │ │
│ │    2 min  •  7 min  •  14 min                             │ │
│ │    Run #423 approaching                                   │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ 🔴 Red Line to 95th/Dan Ryan                              │ │
│ │    4 min  •  11 min  •  19 min                            │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ 🟤 Brown Line to Kimball                                  │ │
│ │    3 min  •  8 min  •  15 min                             │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ 🟣 Purple Line to Linden (Express)                        │ │
│ │    Due  •  12 min                                         │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  PERFORMANCE (Last 1 Hour)                                    │
│  ┌─────────────────┐  ┌─────────────────┐                     │
│  │ On-Time Rate    │  │ Avg Delay       │                     │
│  │ 94.2%          │  │ 2.3 min        │                     │
│  └─────────────────┘  └─────────────────┘                     │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  ALERTS                                                       │
│  ⚠ Red Line: Signal delays northbound. Est. 5-10 min delays.  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  NEARBY BUS STOPS                                             │
│  📍 Fullerton & Sheffield (0.1 mi)                            │
│     Routes: 74, 76                                            │
│  📍 Fullerton & Halsted (0.2 mi)                              │
│     Routes: 8, 74                                             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 10.2 Route Detail Modal

**File:** `src/components/monitor/drilldown/RouteDetailModal.tsx`

When a user clicks on a line in the ticker or filters by route.

```typescript
interface RouteDetailModalProps {
  route: RouteColor;
  onClose: () => void;
}
```

**Layout:**
```
┌───────────────────────────────────────────────────────────────┐
│ ← Back                  🔴 RED LINE                     [✕]   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Howard ←→ 95th/Dan Ryan                                      │
│  Status: ● OPERATIONAL (Minor Delays)                         │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  LIVE TRAINS                                        24 Active │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  [Mini map showing train positions on the line]          │ │
│  │                                                          │ │
│  │  ▲ Howard                                                │ │
│  │  │                                                       │ │
│  │  ● #423 - Fullerton → Howard (2 min)                     │ │
│  │  │                                                       │ │
│  │  ● #421 - Belmont → Howard (8 min)                       │ │
│  │  │                                                       │ │
│  │  ●══════════● Signal Problem                             │ │
│  │  │                                                       │ │
│  │  ▼ 95th/Dan Ryan                                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  PERFORMANCE                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│  │ On-Time    │ │ Headway    │ │ Active     │ │ Delayed    │ │
│  │ 94.1%      │ │ 4.2 min    │ │ 24/26      │ │ 3          │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│                                                               │
│  [Performance trend mini-chart for last 24h]                  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  ACTIVE ALERTS (2)                                            │
│  ⚠ Signal problems near Fullerton. 5-10 min delays.          │
│  ℹ Planned track work this weekend. See schedule.             │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  STATIONS                                        [Filter ▾]   │
│  ┌────────────────────────┬────────────────────────────────┐ │
│  │ Howard                  │ Next: 3 min, 9 min            │ │
│  ├────────────────────────┼────────────────────────────────┤ │
│  │ Jarvis                  │ Next: 2 min, 8 min            │ │
│  ├────────────────────────┼────────────────────────────────┤ │
│  │ Morse                   │ Next: 1 min, 7 min            │ │
│  ├────────────────────────┼────────────────────────────────┤ │
│  │ ...                     │ ...                           │ │
│  └────────────────────────┴────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 10.3 Follow Train Feature

**File:** `src/components/monitor/drilldown/FollowTrainPanel.tsx`

Track a specific train as it moves through the system.

```typescript
interface FollowTrainPanelProps {
  runNumber: string;
  route: RouteColor;
  onClose: () => void;
}
```

**API Endpoint:** `GET /api/monitor/trains/follow?run={runNumber}`

Uses CTA's ttfollow endpoint to get detailed train information.

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Core infrastructure and basic display**

- [x] Create `/monitor` route and layout
- [x] Implement dark theme CSS variables
- [x] Build `MonitorHeader` component
- [x] Set up `MonitorProvider` context
- [x] Create basic `MonitorMapComponent` (extend existing)
- [x] Build `BottomTicker` with line status
- [x] Implement `/api/monitor/status` endpoint
- [x] Implement `/api/monitor/trains/positions` endpoint

**Deliverable:** Basic monitor page with map showing live train positions and line status ticker.

### Phase 2: Data Panels (Week 3-4)
**Weather, alerts, and analytics**

- [x] Implement `/api/monitor/weather` endpoint
- [x] Build `WeatherPanel` component
- [x] Implement `/api/monitor/alerts` endpoint
- [x] Build `AlertsPanel` component
- [x] Design and build `DelayAnalyticsPanel` component
- [x] Implement `/api/monitor/analytics/delays` endpoint (basic version)
- [x] Create right sidebar layout with collapsible panels

**Deliverable:** Functional sidebar with weather, alerts, and basic analytics.

### Phase 3: Social & Advanced Analytics (Week 5-6)
**Social feed and enhanced analytics**

- [x] Research and implement social media API integration
- [x] Build `SocialFeedPanel` component
- [x] Implement sentiment analysis (basic keyword matching)
- [x] Enhance delay analytics with historical data
- [x] Add sparkline charts and visualizations
- [ ] Implement data persistence for analytics (if needed)

**Deliverable:** Social feed panel and enhanced analytics visualizations.

### Phase 4: Drill-Down Views (Week 7-8)
**Detailed station and route views**

- [x] Build `StationDetailModal` component
- [x] Build `RouteDetailModal` component
- [x] Implement `/api/monitor/trains/follow` endpoint
- [x] Build `FollowTrainPanel` component
- [x] Add drill-down animations and transitions
- [ ] Implement breadcrumb navigation

**Deliverable:** Complete drill-down functionality for stations, routes, and trains.

### Phase 5: Polish & Optimization (Week 9-10)
**Performance, accessibility, and UX refinement**

- [ ] Optimize map rendering (clustering, LOD)
- [x] Add keyboard navigation support
- [x] Implement responsive layouts for tablet/mobile
- [x] Add loading skeletons and error states
- [ ] Performance profiling and optimization
- [ ] Add WebSocket support for real-time updates (optional)
- [ ] A11y audit and fixes
- [ ] User preference persistence

**Deliverable:** Production-ready monitor page with polished UX.

---

## 12. File Structure

```
src/
├── app/
│   ├── (app)/
│   │   └── monitor/
│   │       ├── page.tsx                    # Monitor page entry
│   │       └── layout.tsx                  # Monitor-specific layout (full-width)
│   └── api/
│       └── monitor/
│           ├── status/
│           │   └── route.ts                # System status aggregation
│           ├── weather/
│           │   └── route.ts                # Weather data from OpenWeatherMap
│           ├── alerts/
│           │   └── route.ts                # CTA service alerts
│           ├── trains/
│           │   ├── positions/
│           │   │   └── route.ts            # Live train positions
│           │   └── follow/
│           │       └── route.ts            # Follow specific train
│           ├── analytics/
│           │   ├── delays/
│           │   │   └── route.ts            # Delay analytics
│           │   └── performance/
│           │       └── route.ts            # Line performance metrics
│           └── social/
│               └── route.ts                # Social media feed
│
├── components/
│   └── monitor/
│       ├── MonitorHeader.tsx               # Top header bar
│       ├── MonitorLayout.tsx               # Main grid layout
│       ├── MonitorMapComponent.tsx         # Enhanced map with layers
│       ├── BottomTicker.tsx                # Line status ticker
│       ├── SystemStatusIndicator.tsx       # Status badge
│       ├── MapControls.tsx                 # Layer toggles, filters
│       ├── panels/
│       │   ├── WeatherPanel.tsx            # Weather display
│       │   ├── AlertsPanel.tsx             # Service alerts
│       │   ├── SocialFeedPanel.tsx         # Social media feed
│       │   └── DelayAnalyticsPanel.tsx     # Delay statistics
│       ├── drilldown/
│       │   ├── StationDetailModal.tsx      # Station detail view
│       │   ├── RouteDetailModal.tsx        # Route detail view
│       │   └── FollowTrainPanel.tsx        # Train tracking panel
│       ├── markers/
│       │   ├── TrainMarker.tsx             # Live train marker
│       │   ├── BusMarker.tsx               # Live bus marker
│       │   └── StationMarker.tsx           # Station marker
│       └── charts/
│           ├── Sparkline.tsx               # Mini trend chart
│           ├── PerformanceGauge.tsx        # Circular progress
│           └── SentimentBar.tsx            # Sentiment distribution
│
├── lib/
│   ├── types/
│   │   └── monitor.ts                      # All monitor-specific types
│   ├── providers/
│   │   └── MonitorProvider.tsx             # Monitor state context
│   └── hooks/
│       ├── useMonitorData.ts               # Combined data hooks
│       ├── useSystemStatus.ts              # System status hook
│       ├── useWeather.ts                   # Weather data hook
│       ├── useAlerts.ts                    # Alerts hook
│       ├── useTrainPositions.ts            # Live train positions hook
│       ├── useDelayAnalytics.ts            # Analytics hook
│       └── useSocialFeed.ts                # Social feed hook
│
└── styles/
    └── monitor.css                         # Monitor-specific styles (optional)
```

---

## 13. Environment Variables

Add the following to `.env.local`:

```bash
# Weather API (choose one)
OPENWEATHER_API_KEY=your_openweathermap_api_key
# OR use Weather.gov (no key needed)

# Social Media APIs (optional, for social feed)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# Existing (already in use)
CTA_TRAIN_API_KEY=existing_key
CTA_BUS_TRACKER_API_KEY=existing_key
MAPBOX_SECRET_TOKEN=existing_key
```

---

## 14. External API Reference

### CTA Train Tracker API

**Base URL:** `https://lapi.transitchicago.com/api/1.0/`

| Endpoint | Description | Used For |
|----------|-------------|----------|
| `ttarrivals.aspx` | Arrival predictions | Station arrivals |
| `ttpositions.aspx` | Train locations | Live train map |
| `ttfollow.aspx` | Follow a train | Train tracking |

### CTA Customer Alerts API

**Base URL:** `http://www.transitchicago.com/api/1.0/`

| Endpoint | Description | Used For |
|----------|-------------|----------|
| `alerts.aspx` | Service alerts | Alerts panel |
| `routes.aspx` | Route information | Route metadata |

### Weather APIs

**Option 1: OpenWeatherMap**
- URL: `https://api.openweathermap.org/data/3.0/onecall`
- Cost: Free tier available (1000 calls/day)
- Features: Current, forecast, alerts

**Option 2: Weather.gov**
- URL: `https://api.weather.gov/`
- Cost: Free (US government)
- Features: Forecasts, alerts, observations

### Social Media APIs

**Twitter/X API v2**
- URL: `https://api.twitter.com/2/`
- Cost: Basic tier $100/month for search
- Alternative: Use CTA's official Twitter RSS feed

**Reddit API**
- URL: `https://oauth.reddit.com/`
- Cost: Free with rate limits
- Subreddits: r/chicago, r/ChicagoTransit

---

## 15. Performance Considerations

### Map Optimization
- Use marker clustering for zoomed-out views
- Implement level-of-detail (LOD) for markers
- Use WebGL rendering for large numbers of markers
- Debounce map move events
- Lazy load detail panels

### Data Optimization
- Implement request deduplication
- Use React Query's stale-while-revalidate
- Batch API requests where possible
- Consider WebSocket for real-time updates
- Compress responses with gzip

### Rendering Optimization
- Virtualize long lists (alerts, social feed)
- Memoize expensive components
- Use CSS containment for panels
- Lazy load charts and visualizations
- Skeleton loading states

---

## 16. Accessibility Requirements

- Keyboard navigation for all interactive elements
- ARIA labels for status indicators
- Color-blind friendly alternatives (patterns, icons)
- Screen reader announcements for updates
- Focus management in modals
- Reduced motion option
- High contrast mode support

---

## 17. Future Enhancements

### Phase 2+ Features
- Push notifications for alerts
- Custom alert subscriptions
- Historical playback mode
- Predictive delay warnings
- Crowdsourced reports integration
- Bus real-time tracking
- Metra integration
- Divvy bike stations
- Traffic overlay
- Multi-monitor dashboard mode
- API for external integrations
- Mobile app companion

---

*This specification is a living document and should be updated as implementation progresses and requirements evolve.*
