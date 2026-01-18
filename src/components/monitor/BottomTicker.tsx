// src/components/monitor/BottomTicker.tsx
'use client';

import { useMonitor } from '@/lib/providers/MonitorProvider';
import type { RouteColor, LineStatus, ServiceStatus } from '@/lib/types/monitor';

interface BottomTickerProps {
  lineStatuses: Partial<Record<RouteColor, LineStatus>>;
  onLineClick?: (route: RouteColor) => void;
}

// Line display configuration
const LINE_CONFIG: Record<RouteColor, { name: string; shortName: string; bgClass: string }> = {
  Red: { name: 'Red Line', shortName: 'RED', bgClass: 'monitor-line-bg-red' },
  Blue: { name: 'Blue Line', shortName: 'BLUE', bgClass: 'monitor-line-bg-blue' },
  Brn: { name: 'Brown Line', shortName: 'BRN', bgClass: 'monitor-line-bg-brown' },
  G: { name: 'Green Line', shortName: 'GRN', bgClass: 'monitor-line-bg-green' },
  Org: { name: 'Orange Line', shortName: 'ORG', bgClass: 'monitor-line-bg-orange' },
  P: { name: 'Purple Line', shortName: 'PRP', bgClass: 'monitor-line-bg-purple' },
  Pink: { name: 'Pink Line', shortName: 'PINK', bgClass: 'monitor-line-bg-pink' },
  Y: { name: 'Yellow Line', shortName: 'YEL', bgClass: 'monitor-line-bg-yellow' },
};

// Order of lines to display
const LINE_ORDER: RouteColor[] = ['Red', 'Blue', 'Brn', 'G', 'Org', 'P', 'Pink', 'Y'];

function getStatusIndicator(status: ServiceStatus): { icon: string; className: string } {
  switch (status) {
    case 'operational':
      return { icon: '●', className: 'text-[hsl(var(--status-nominal))]' };
    case 'disrupted':
      return { icon: '●', className: 'text-[hsl(var(--status-degraded))]' };
    case 'down':
      return { icon: '●', className: 'text-[hsl(var(--status-critical))] animate-pulse' };
    default:
      return { icon: '○', className: 'text-[hsl(var(--monitor-text-muted))]' };
  }
}

function LineStatusCard({
  route,
  status,
  onClick,
}: {
  route: RouteColor;
  status: LineStatus | undefined;
  onClick: () => void;
}) {
  const config = LINE_CONFIG[route];
  const serviceStatus = getStatusIndicator(status?.status || 'operational');

  const onTimePerformance = status?.onTimePerformance ?? 100;
  const activeTrains = status?.activeTrains ?? 0;
  const delayedTrains = status?.delayedTrains ?? 0;

  const hasDelays = delayedTrains > 0 || (status?.status === 'disrupted');

  return (
    <button
      onClick={onClick}
      className={`
        line-status-card flex flex-col items-center min-w-[80px] sm:min-w-[100px]
        ${hasDelays ? 'border-[hsl(var(--status-degraded)/0.5)]' : ''}
      `}
    >
      {/* Line indicator */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${config.bgClass}`} />
        <span className="monitor-mono text-xs font-medium text-[hsl(var(--monitor-text-primary))]">
          {config.shortName}
        </span>
        <span className={`text-[10px] ${serviceStatus.className}`}>
          {serviceStatus.icon}
        </span>
      </div>

      {/* Performance percentage */}
      <div className="monitor-mono text-lg font-bold text-[hsl(var(--monitor-text-primary))]">
        {onTimePerformance.toFixed(1)}%
      </div>

      {/* Train count */}
      <div className="monitor-mono text-[10px] text-[hsl(var(--monitor-text-muted))]">
        {activeTrains} trn{delayedTrains > 0 && (
          <span className="text-[hsl(var(--status-degraded))]"> ({delayedTrains} dly)</span>
        )}
      </div>
    </button>
  );
}

export function BottomTicker({ lineStatuses, onLineClick }: BottomTickerProps) {
  const { openRouteDetail } = useMonitor();

  const handleLineClick = (route: RouteColor) => {
    if (onLineClick) {
      onLineClick(route);
    } else {
      openRouteDetail(route);
    }
  };

  return (
    <div className="monitor-ticker absolute bottom-0 left-0 right-0 h-[72px] bg-[hsl(var(--monitor-bg-secondary)/0.95)] border-t border-[hsl(var(--monitor-border))] backdrop-blur-sm">
      <div className="h-full px-4 flex items-center">
        {/* Scrollable line status cards */}
        <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
          {LINE_ORDER.map((route) => (
            <LineStatusCard
              key={route}
              route={route}
              status={lineStatuses[route]}
              onClick={() => handleLineClick(route)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default BottomTicker;
