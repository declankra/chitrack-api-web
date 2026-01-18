// src/components/monitor/panels/WeatherPanel.tsx
'use client';

import { useState } from 'react';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  Wind,
  Droplets,
  Eye,
  Thermometer,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sunrise,
  Sunset,
} from 'lucide-react';
import type { WeatherData, WeatherCondition, WeatherAlert } from '@/lib/types/monitor';

interface WeatherPanelProps {
  data: {
    current: WeatherData;
    forecast?: Array<{
      time: string;
      temperature: number;
      condition: WeatherCondition;
    }>;
    alerts: WeatherAlert[];
  } | null;
  isLoading?: boolean;
  error?: Error | null;
}

// Get weather icon component
function getWeatherIcon(condition: WeatherCondition, size = 'h-8 w-8') {
  const iconProps = { className: `${size} text-[hsl(var(--monitor-text-primary))]` };

  switch (condition) {
    case 'clear':
      return <Sun {...iconProps} className={`${size} text-[hsl(var(--status-nominal))]`} />;
    case 'partly-cloudy':
      return <CloudSun {...iconProps} />;
    case 'cloudy':
    case 'overcast':
      return <Cloud {...iconProps} />;
    case 'rain':
    case 'heavy-rain':
    case 'thunderstorm':
      return <CloudRain {...iconProps} className={`${size} text-[hsl(var(--monitor-accent-cyan))]`} />;
    case 'snow':
    case 'heavy-snow':
    case 'blizzard':
      return <CloudSnow {...iconProps} />;
    case 'windy':
      return <Wind {...iconProps} />;
    default:
      return <Cloud {...iconProps} />;
  }
}

function WeatherAlertCard({ alert }: { alert: WeatherAlert }) {
  const [expanded, setExpanded] = useState(false);

  const severityColors = {
    minor: 'border-[hsl(var(--monitor-accent-cyan))]',
    moderate: 'border-[hsl(var(--status-degraded))]',
    severe: 'border-[hsl(var(--status-critical))]',
    extreme: 'border-[hsl(var(--status-critical))] bg-[hsl(var(--status-critical)/0.1)]',
  };

  return (
    <div
      className={`rounded border-l-2 p-2 bg-[hsl(var(--monitor-bg-tertiary))] ${severityColors[alert.severity]}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between gap-2"
      >
        <div className="flex items-start gap-2 text-left">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-degraded))] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-[hsl(var(--monitor-text-primary))]">
              {alert.event}
            </p>
            <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">
              Until {new Date(alert.end).toLocaleString('en-US', {
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
        )}
      </button>
      {expanded && (
        <p className="mt-2 text-[10px] text-[hsl(var(--monitor-text-secondary))] line-clamp-4">
          {alert.headline}
        </p>
      )}
    </div>
  );
}

export function WeatherPanel({ data, isLoading, error }: WeatherPanelProps) {
  if (isLoading) {
    return (
      <div className="monitor-panel h-full">
        <div className="monitor-panel-header">
          <span className="monitor-panel-title">WEATHER</span>
          <span className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Chicago, IL</span>
        </div>
        <div className="p-4 flex items-center justify-center h-32">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-12 w-12 bg-[hsl(var(--monitor-bg-tertiary))] rounded-full" />
            <div className="h-4 w-20 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="monitor-panel h-full">
        <div className="monitor-panel-header">
          <span className="monitor-panel-title">WEATHER</span>
        </div>
        <div className="p-4 text-center">
          <Cloud className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
          <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
            {error ? 'Failed to load weather' : 'No data available'}
          </p>
        </div>
      </div>
    );
  }

  const { current, alerts } = data;

  return (
    <div className="monitor-panel h-full flex flex-col">
      <div className="monitor-panel-header">
        <span className="monitor-panel-title">WEATHER</span>
        <span className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Chicago, IL</span>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Current conditions */}
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {getWeatherIcon(current.condition, 'h-12 w-12')}
          </div>
          <div>
            <div className="monitor-value text-3xl">{current.temperature}°F</div>
            <p className="text-xs text-[hsl(var(--monitor-text-secondary))]">
              Feels like {current.feelsLike}°F
            </p>
            <p className="text-xs text-[hsl(var(--monitor-text-muted))] capitalize">
              {current.conditionDescription}
            </p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded">
            <Wind className="h-4 w-4 text-[hsl(var(--monitor-accent-cyan))]" />
            <div>
              <p className="monitor-mono text-xs text-[hsl(var(--monitor-text-primary))]">
                {current.windSpeed} mph {current.windDirectionCardinal}
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Wind</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded">
            <Droplets className="h-4 w-4 text-[hsl(var(--monitor-accent-cyan))]" />
            <div>
              <p className="monitor-mono text-xs text-[hsl(var(--monitor-text-primary))]">
                {current.humidity}%
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Humidity</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded">
            <Eye className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
            <div>
              <p className="monitor-mono text-xs text-[hsl(var(--monitor-text-primary))]">
                {current.visibility} mi
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Visibility</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded">
            <Thermometer className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
            <div>
              <p className="monitor-mono text-xs text-[hsl(var(--monitor-text-primary))]">
                {current.dewPoint}°F
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Dew Point</p>
            </div>
          </div>
        </div>

        {/* Sun times */}
        <div className="flex justify-between text-xs text-[hsl(var(--monitor-text-secondary))] px-2">
          <div className="flex items-center gap-1">
            <Sunrise className="h-3.5 w-3.5" />
            <span>{current.sunrise}</span>
          </div>
          <div className="flex items-center gap-1">
            <Sunset className="h-3.5 w-3.5" />
            <span>{current.sunset}</span>
          </div>
        </div>

        {/* Weather alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] uppercase tracking-wider">
              Alerts
            </p>
            {alerts.map((alert) => (
              <WeatherAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WeatherPanel;
