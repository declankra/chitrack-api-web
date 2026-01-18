// src/components/monitor/drilldown/RouteDetailModal.tsx
'use client';

import { useEffect } from 'react';
import { X, ChevronRight, Train, Clock, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { useTrainPositions } from '@/lib/hooks/useMonitorData';
import { useAlerts } from '@/lib/hooks/useMonitorData';
import type { RouteColor, LiveTrain, LineStatus } from '@/lib/types/monitor';

interface RouteDetailModalProps {
  route: RouteColor;
  lineStatus?: LineStatus;
  onClose: () => void;
}

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

// Route terminals
const ROUTE_TERMINALS: Record<RouteColor, { north: string; south: string }> = {
  Red: { north: 'Howard', south: '95th/Dan Ryan' },
  Blue: { north: "O'Hare", south: 'Forest Park' },
  Brn: { north: 'Kimball', south: 'Loop' },
  G: { north: 'Harlem/Lake', south: 'Ashland/63rd or Cottage Grove' },
  Org: { north: 'Loop', south: 'Midway' },
  P: { north: 'Linden', south: 'Loop' },
  Pink: { north: 'Loop', south: '54th/Cermak' },
  Y: { north: 'Dempster-Skokie', south: 'Howard' },
};

// Line colors for styling
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

const LINE_HEX: Record<RouteColor, string> = {
  Red: '#dc2626',
  Blue: '#3b82f6',
  Brn: '#92400e',
  G: '#16a34a',
  Org: '#f97316',
  P: '#9333ea',
  Pink: '#f472b6',
  Y: '#facc15',
};

// Status badge component
function StatusBadge({ status }: { status: 'operational' | 'disrupted' | 'down' }) {
  const config = {
    operational: {
      label: 'OPERATIONAL',
      className: 'bg-[hsl(var(--status-nominal)/0.2)] text-[hsl(var(--status-nominal))]',
    },
    disrupted: {
      label: 'DISRUPTED',
      className: 'bg-[hsl(var(--status-degraded)/0.2)] text-[hsl(var(--status-degraded))]',
    },
    down: {
      label: 'DOWN',
      className: 'bg-[hsl(var(--status-critical)/0.2)] text-[hsl(var(--status-critical))]',
    },
  };

  const { label, className } = config[status];

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}

// Train card component
function TrainCard({ train }: { train: LiveTrain }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded">
      <div className="flex-shrink-0">
        <Train className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="monitor-mono text-xs font-medium text-[hsl(var(--monitor-text-primary))]">
            #{train.runNumber}
          </span>
          {train.isDelayed && (
            <span className="text-[10px] text-[hsl(var(--status-degraded))] font-medium">
              DELAYED
            </span>
          )}
          {train.isApproaching && (
            <span className="text-[10px] text-[hsl(var(--status-nominal))] font-medium">
              APPROACHING
            </span>
          )}
        </div>
        <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] truncate">
          → {train.destinationName}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-[hsl(var(--monitor-text-secondary))]">
          {train.nextStationName}
        </p>
      </div>
    </div>
  );
}

export function RouteDetailModal({
  route,
  lineStatus,
  onClose,
}: RouteDetailModalProps) {
  // Fetch train positions for this route
  const { data: trainsData, isLoading: trainsLoading } = useTrainPositions([route]);

  // Fetch alerts for this route
  const { data: alertsData, isLoading: alertsLoading } = useAlerts([route]);

  const trains = trainsData?.trains || [];
  const alerts = alertsData?.alerts || [];
  const terminals = ROUTE_TERMINALS[route];
  const routeName = ROUTE_NAMES[route];

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Calculate stats
  const activeTrains = trains.length;
  const delayedTrains = trains.filter((t) => t.isDelayed).length;
  const onTimePerformance = lineStatus?.onTimePerformance ?? (
    activeTrains > 0 ? Math.round(((activeTrains - delayedTrains) / activeTrains) * 100) : 100
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] bg-[hsl(var(--monitor-bg-secondary))] border border-[hsl(var(--monitor-border))] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header with route color accent */}
        <div
          className="p-4 border-b border-[hsl(var(--monitor-border))]"
          style={{ borderTopColor: LINE_HEX[route], borderTopWidth: 3 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-1 hover:bg-[hsl(var(--monitor-bg-hover))] rounded"
              >
                <ChevronRight className="h-5 w-5 text-[hsl(var(--monitor-text-muted))] rotate-180" />
              </button>
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full ${LINE_COLORS[route]}`} />
                <h2 className="monitor-mono text-lg font-bold text-[hsl(var(--monitor-text-primary))] uppercase">
                  {routeName}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[hsl(var(--monitor-bg-hover))] rounded"
            >
              <X className="h-5 w-5 text-[hsl(var(--monitor-text-muted))]" />
            </button>
          </div>

          {/* Terminals and status */}
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
              {terminals.north} ↔ {terminals.south}
            </p>
            <StatusBadge status={lineStatus?.status || 'operational'} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded text-center">
              <p className="monitor-mono text-lg font-bold text-[hsl(var(--monitor-text-primary))]">
                {activeTrains}
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Active</p>
            </div>
            <div className="p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded text-center">
              <p className="monitor-mono text-lg font-bold text-[hsl(var(--status-degraded))]">
                {delayedTrains}
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Delayed</p>
            </div>
            <div className="p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded text-center">
              <p className="monitor-mono text-lg font-bold text-[hsl(var(--status-nominal))]">
                {onTimePerformance}%
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">On-Time</p>
            </div>
            <div className="p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded text-center">
              <p className="monitor-mono text-lg font-bold text-[hsl(var(--monitor-text-primary))]">
                {lineStatus?.avgHeadway?.toFixed(1) || '--'}
              </p>
              <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Headway</p>
            </div>
          </div>

          {/* Active alerts */}
          {alerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-degraded))]" />
                <span className="monitor-panel-title">ACTIVE ALERTS ({alerts.length})</span>
              </div>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-2 rounded border-l-2 ${
                      alert.severity === 'critical' || alert.severity === 'major'
                        ? 'border-[hsl(var(--status-degraded))] bg-[hsl(var(--status-degraded)/0.1)]'
                        : 'border-[hsl(var(--monitor-accent-cyan))] bg-[hsl(var(--monitor-bg-tertiary))]'
                    }`}
                  >
                    <p className="text-xs text-[hsl(var(--monitor-text-primary))]">
                      {alert.headline}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] mt-1 line-clamp-2">
                      {alert.shortDescription}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live trains section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Train className="h-4 w-4 text-[hsl(var(--monitor-accent-cyan))]" />
              <span className="monitor-panel-title">LIVE TRAINS</span>
              {trainsLoading && (
                <div className="w-4 h-4 border-2 border-[hsl(var(--monitor-accent-cyan))] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {trainsLoading && trains.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-14 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
                ))}
              </div>
            ) : trains.length > 0 ? (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {trains.map((train) => (
                  <TrainCard key={train.runNumber} train={train} />
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Train className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
                <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
                  No active trains
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[hsl(var(--monitor-border))] bg-[hsl(var(--monitor-bg-tertiary))]">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-[hsl(var(--monitor-text-secondary))] hover:text-[hsl(var(--monitor-text-primary))] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default RouteDetailModal;
