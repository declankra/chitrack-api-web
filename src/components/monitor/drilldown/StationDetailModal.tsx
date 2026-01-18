// src/components/monitor/drilldown/StationDetailModal.tsx
'use client';

import { useEffect } from 'react';
import { X, MapPin, Accessibility, Clock, AlertTriangle, Bus, ChevronRight } from 'lucide-react';
import { useStationArrivals } from '@/lib/hooks/useStationArrivals';
import { useMonitor } from '@/lib/providers/MonitorProvider';
import type { RouteColor } from '@/lib/types/monitor';

interface StationDetailModalProps {
  stationId: string;
  stationName: string;
  lines: RouteColor[];
  onClose: () => void;
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

// Format arrival time
function formatArrivalTime(arrT: string): string {
  const arrivalDate = new Date(
    parseInt(arrT.substring(0, 4)),
    parseInt(arrT.substring(4, 6)) - 1,
    parseInt(arrT.substring(6, 8)),
    parseInt(arrT.substring(9, 11)),
    parseInt(arrT.substring(12, 14)),
    parseInt(arrT.substring(15, 17))
  );
  const now = new Date();
  const diffMs = arrivalDate.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));

  if (diffMins <= 0) return 'Due';
  if (diffMins === 1) return '1 min';
  return `${diffMins} min`;
}

export function StationDetailModal({
  stationId,
  stationName,
  lines,
  onClose,
}: StationDetailModalProps) {
  const { data: arrivals, isLoading, error, lastUpdated, refresh } = useStationArrivals(stationId);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-[hsl(var(--monitor-bg-secondary))] border border-[hsl(var(--monitor-border))] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--monitor-border))]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 hover:bg-[hsl(var(--monitor-bg-hover))] rounded"
            >
              <ChevronRight className="h-5 w-5 text-[hsl(var(--monitor-text-muted))] rotate-180" />
            </button>
            <div>
              <h2 className="monitor-mono text-lg font-bold text-[hsl(var(--monitor-text-primary))] uppercase">
                {stationName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {lines.map((line) => (
                  <span
                    key={line}
                    className={`w-3 h-3 rounded-full ${LINE_COLORS[line]}`}
                  />
                ))}
                <span className="text-xs text-[hsl(var(--monitor-text-muted))]">
                  {lines.length > 1 ? `${lines.length} lines` : '1 line'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[hsl(var(--monitor-bg-hover))] rounded"
          >
            <X className="h-5 w-5 text-[hsl(var(--monitor-text-muted))]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Arrivals section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[hsl(var(--monitor-accent-cyan))]" />
                <span className="monitor-panel-title">ARRIVALS</span>
              </div>
              {lastUpdated && (
                <button
                  onClick={refresh}
                  className="text-[10px] text-[hsl(var(--monitor-text-muted))] hover:text-[hsl(var(--monitor-accent-cyan))]"
                >
                  Updated {new Date(lastUpdated).toLocaleTimeString()}
                </button>
              )}
            </div>

            {isLoading && !arrivals && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-16 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
                ))}
              </div>
            )}

            {error && (
              <div className="text-center py-4">
                <AlertTriangle className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
                <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
                  Failed to load arrivals
                </p>
              </div>
            )}

            {arrivals && arrivals.length > 0 && (
              <div className="space-y-2">
                {arrivals.flatMap((station) => station.stops || []).map((stopData, idx) => (
                  <div
                    key={stopData.stopId || idx}
                    className="p-3 bg-[hsl(var(--monitor-bg-tertiary))] rounded"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`w-3 h-3 rounded-full ${LINE_COLORS[stopData.route as RouteColor] || 'bg-gray-500'}`}
                      />
                      <span className="text-xs font-medium text-[hsl(var(--monitor-text-primary))]">
                        {stopData.stopName}
                      </span>
                    </div>

                    {stopData.arrivals && stopData.arrivals.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {stopData.arrivals.slice(0, 4).map((arrival, arrIdx) => (
                          <span
                            key={`${arrival.rn}-${arrIdx}`}
                            className={`
                              monitor-mono px-2 py-1 rounded text-sm
                              ${arrival.isApp === '1'
                                ? 'bg-[hsl(var(--status-nominal)/0.2)] text-[hsl(var(--status-nominal))]'
                                : arrival.isDly === '1'
                                ? 'bg-[hsl(var(--status-degraded)/0.2)] text-[hsl(var(--status-degraded))]'
                                : 'bg-[hsl(var(--monitor-bg-hover))] text-[hsl(var(--monitor-text-primary))]'}
                            `}
                          >
                            {formatArrivalTime(arrival.arrT)}
                            {arrival.isDly === '1' && ' (dly)'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[hsl(var(--monitor-text-muted))]">
                        No upcoming arrivals
                      </span>
                    )}

                    <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] mt-1">
                      → {stopData.arrivals?.[0]?.destNm || 'Unknown'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {arrivals && arrivals.length === 0 && (
              <div className="text-center py-4">
                <Clock className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
                <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
                  No arrivals at this time
                </p>
              </div>
            )}
          </div>

          {/* Station info */}
          <div className="pt-2 border-t border-[hsl(var(--monitor-border))]">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
              <span className="monitor-panel-title">STATION INFO</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded">
                <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] uppercase">
                  Station ID
                </p>
                <p className="monitor-mono text-sm text-[hsl(var(--monitor-text-primary))]">
                  {stationId}
                </p>
              </div>
              <div className="p-2 bg-[hsl(var(--monitor-bg-tertiary))] rounded">
                <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] uppercase">
                  Lines
                </p>
                <p className="monitor-mono text-sm text-[hsl(var(--monitor-text-primary))]">
                  {lines.length}
                </p>
              </div>
            </div>
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

export default StationDetailModal;
