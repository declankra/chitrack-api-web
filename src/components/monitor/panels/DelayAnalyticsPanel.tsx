// src/components/monitor/panels/DelayAnalyticsPanel.tsx
'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, MapPin, Clock, AlertTriangle } from 'lucide-react';
import type { SystemStatus, RouteColor, LineStatus, DelayReason } from '@/lib/types/monitor';

interface DelayAnalyticsPanelProps {
  data: SystemStatus | null;
  isLoading?: boolean;
  error?: Error | null;
}

// Time range options
type TimeRange = '1h' | '4h' | '24h';

// Get trend icon
function getTrendIcon(trend: 'improving' | 'stable' | 'worsening') {
  switch (trend) {
    case 'improving':
      return <TrendingDown className="h-4 w-4 text-[hsl(var(--status-nominal))]" />;
    case 'worsening':
      return <TrendingUp className="h-4 w-4 text-[hsl(var(--status-critical))]" />;
    default:
      return <Minus className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />;
  }
}

// Get performance bar color
function getPerformanceColor(percentage: number): string {
  if (percentage >= 95) return 'bg-[hsl(var(--status-nominal))]';
  if (percentage >= 85) return 'bg-[hsl(var(--monitor-accent-cyan))]';
  if (percentage >= 70) return 'bg-[hsl(var(--status-degraded))]';
  return 'bg-[hsl(var(--status-critical))]';
}

// Line color mapping
const LINE_COLORS: Record<RouteColor, string> = {
  Red: 'bg-red-600',
  Blue: 'bg-blue-500',
  Brn: 'bg-amber-800',
  G: 'bg-green-600',
  Org: 'bg-orange-500',
  P: 'bg-purple-600',
  Pink: 'bg-pink-400',
  Y: 'bg-yellow-400',
};

// Calculate overall metrics from line data
function calculateOverallMetrics(lines: Partial<Record<RouteColor, LineStatus>>) {
  const lineValues = Object.values(lines).filter(Boolean) as LineStatus[];
  if (lineValues.length === 0) {
    return {
      currentDelayRate: 0,
      baselineDelayRate: 8, // Baseline average
      trend: 'stable' as const,
    };
  }

  const totalActive = lineValues.reduce((sum, l) => sum + l.activeTrains, 0);
  const totalDelayed = lineValues.reduce((sum, l) => sum + l.delayedTrains, 0);
  const currentDelayRate = totalActive > 0 ? (totalDelayed / totalActive) * 100 : 0;

  // Determine trend based on delay rate
  const baselineDelayRate = 8; // Typical baseline
  const trend: 'improving' | 'stable' | 'worsening' =
    currentDelayRate < baselineDelayRate - 2
      ? 'improving'
      : currentDelayRate > baselineDelayRate + 2
      ? 'worsening'
      : 'stable';

  return {
    currentDelayRate: Math.round(currentDelayRate * 10) / 10,
    baselineDelayRate,
    trend,
  };
}

// Get delay hotspots (lines with highest delay rates)
function getDelayHotspots(lines: Partial<Record<RouteColor, LineStatus>>) {
  const lineEntries = Object.entries(lines) as [RouteColor, LineStatus][];

  return lineEntries
    .filter(([, status]) => status && status.delayedTrains > 0)
    .map(([route, status]) => ({
      route,
      routeName: status.routeName,
      delayRate:
        status.activeTrains > 0
          ? (status.delayedTrains / status.activeTrains) * 100
          : 0,
      delayedTrains: status.delayedTrains,
    }))
    .sort((a, b) => b.delayRate - a.delayRate)
    .slice(0, 3);
}

// Mini sparkline component
function Sparkline({ data, height = 32 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const width = 100;
  const stepX = width / (data.length - 1);

  const points = data
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8">
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--monitor-accent-cyan))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DelayAnalyticsPanel({ data, isLoading, error }: DelayAnalyticsPanelProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  if (isLoading) {
    return (
      <div className="monitor-panel h-full">
        <div className="monitor-panel-header">
          <span className="monitor-panel-title">DELAY ANALYTICS</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="animate-pulse">
            <div className="h-20 bg-[hsl(var(--monitor-bg-tertiary))] rounded mb-4" />
            <div className="h-32 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="monitor-panel h-full">
        <div className="monitor-panel-header">
          <span className="monitor-panel-title">DELAY ANALYTICS</span>
        </div>
        <div className="p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
          <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
            {error ? 'Failed to load analytics' : 'No data available'}
          </p>
        </div>
      </div>
    );
  }

  const { currentDelayRate, baselineDelayRate, trend } = calculateOverallMetrics(data.lines);
  const deviation = currentDelayRate - baselineDelayRate;
  const hotspots = getDelayHotspots(data.lines);

  // Mock timeline data for sparkline
  const timelineData = [8, 9, 7, 10, 12, 11, 9, currentDelayRate];

  return (
    <div className="monitor-panel h-full flex flex-col">
      <div className="monitor-panel-header">
        <span className="monitor-panel-title">DELAY ANALYTICS</span>
        <div className="flex items-center gap-1">
          {(['1h', '4h', '24h'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                timeRange === range
                  ? 'bg-[hsl(var(--monitor-accent-cyan)/0.2)] text-[hsl(var(--monitor-accent-cyan))]'
                  : 'text-[hsl(var(--monitor-text-muted))] hover:bg-[hsl(var(--monitor-bg-hover))]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Overall delay rate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[hsl(var(--monitor-text-muted))] uppercase">
              Current Delay Rate
            </span>
            <div className="flex items-center gap-1">
              {getTrendIcon(trend)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded-full overflow-hidden mb-1">
            <div
              className={`h-full ${getPerformanceColor(100 - currentDelayRate)} transition-all duration-500`}
              style={{ width: `${Math.min(currentDelayRate * 5, 100)}%` }}
            />
          </div>

          <div className="flex items-baseline justify-between">
            <span className="monitor-mono text-xl font-bold text-[hsl(var(--monitor-text-primary))]">
              {currentDelayRate.toFixed(1)}%
            </span>
            <span className="text-[10px] text-[hsl(var(--monitor-text-muted))]">
              Baseline: {baselineDelayRate}%{' '}
              <span
                className={
                  deviation > 0
                    ? 'text-[hsl(var(--status-critical))]'
                    : deviation < 0
                    ? 'text-[hsl(var(--status-nominal))]'
                    : ''
                }
              >
                ({deviation > 0 ? '+' : ''}
                {deviation.toFixed(1)}%)
              </span>
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="p-3 bg-[hsl(var(--monitor-bg-tertiary))] rounded">
          <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] mb-2">
            Last {timeRange} trend
          </p>
          <Sparkline data={timelineData} />
        </div>

        {/* Delay hotspots */}
        {hotspots.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-2">
              <MapPin className="h-3.5 w-3.5 text-[hsl(var(--status-degraded))]" />
              <span className="text-[10px] text-[hsl(var(--monitor-text-muted))] uppercase">
                Delay Hotspots
              </span>
            </div>
            <div className="space-y-1.5">
              {hotspots.map((hotspot, index) => (
                <div
                  key={hotspot.route}
                  className="flex items-center gap-2 p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded"
                >
                  <span className="text-[10px] text-[hsl(var(--monitor-text-muted))]">
                    {index + 1}.
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${LINE_COLORS[hotspot.route]}`}
                  />
                  <span className="flex-1 text-xs text-[hsl(var(--monitor-text-primary))]">
                    {hotspot.routeName}
                  </span>
                  <span className="monitor-mono text-xs text-[hsl(var(--status-degraded))]">
                    {hotspot.delayRate.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System-wide stats */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Clock className="h-3.5 w-3.5 text-[hsl(var(--monitor-text-muted))]" />
            <span className="text-[10px] text-[hsl(var(--monitor-text-muted))] uppercase">
              System Overview
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded text-center">
              <p className="monitor-mono text-lg font-bold text-[hsl(var(--monitor-text-primary))]">
                {data.trains.activeCount}
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Active Trains</p>
            </div>
            <div className="p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded text-center">
              <p className="monitor-mono text-lg font-bold text-[hsl(var(--status-degraded))]">
                {data.trains.delayedCount}
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Delayed</p>
            </div>
          </div>
        </div>

        {/* Line performance bars */}
        <div>
          <span className="text-[10px] text-[hsl(var(--monitor-text-muted))] uppercase">
            Line Performance
          </span>
          <div className="mt-2 space-y-1.5">
            {(Object.entries(data.lines) as [RouteColor, LineStatus][])
              .filter(([, status]) => status)
              .map(([route, status]) => (
                <div key={route} className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${LINE_COLORS[route]} flex-shrink-0`}
                  />
                  <div className="flex-1 h-1.5 bg-[hsl(var(--monitor-bg-tertiary))] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getPerformanceColor(status.onTimePerformance)} transition-all duration-500`}
                      style={{ width: `${status.onTimePerformance}%` }}
                    />
                  </div>
                  <span className="monitor-mono text-[10px] text-[hsl(var(--monitor-text-secondary))] w-10 text-right">
                    {status.onTimePerformance.toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DelayAnalyticsPanel;
