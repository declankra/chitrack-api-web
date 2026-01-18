// src/components/monitor/drilldown/FollowTrainPanel.tsx
'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronRight, Train, MapPin, Clock, AlertTriangle, Navigation, Radio } from 'lucide-react';
import type { RouteColor } from '@/lib/types/monitor';

interface FollowTrainPanelProps {
  runNumber: string;
  route: RouteColor;
  onClose: () => void;
}

// Route display configuration
const ROUTE_CONFIG: Record<RouteColor, { name: string; color: string; bgClass: string }> = {
  Red: { name: 'Red Line', color: '#c60c30', bgClass: 'bg-red-600' },
  Blue: { name: 'Blue Line', color: '#00a1de', bgClass: 'bg-blue-500' },
  Brn: { name: 'Brown Line', color: '#62361b', bgClass: 'bg-amber-800' },
  G: { name: 'Green Line', color: '#009b3a', bgClass: 'bg-green-600' },
  Org: { name: 'Orange Line', color: '#f9461c', bgClass: 'bg-orange-500' },
  P: { name: 'Purple Line', color: '#522398', bgClass: 'bg-purple-600' },
  Pink: { name: 'Pink Line', color: '#e27ea6', bgClass: 'bg-pink-400' },
  Y: { name: 'Yellow Line', color: '#f9e300', bgClass: 'bg-yellow-400' },
};

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

// Hook to fetch train follow data
function useTrainFollow(runNumber: string) {
  return useQuery<{ train: TrainFollowData; lastUpdated: string }>({
    queryKey: ['monitor', 'trains', 'follow', runNumber],
    queryFn: async () => {
      const response = await fetch(`/api/monitor/trains/follow?run=${runNumber}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch train data');
      }
      return response.json();
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    retry: 1,
  });
}

// Direction indicator based on heading
function getDirectionLabel(heading: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
}

// Stop card component
function StopCard({ stop, isNext }: { stop: TrainFollowData['upcomingStops'][0]; isNext: boolean }) {
  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded transition-colors
        ${isNext
          ? 'bg-[hsl(var(--monitor-accent-cyan)/0.15)] border border-[hsl(var(--monitor-accent-cyan)/0.3)]'
          : 'bg-[hsl(var(--monitor-bg-tertiary))]'
        }
      `}
    >
      {/* Timeline indicator */}
      <div className="flex flex-col items-center gap-1">
        <div
          className={`
            w-3 h-3 rounded-full
            ${isNext
              ? 'bg-[hsl(var(--monitor-accent-cyan))] animate-pulse'
              : stop.isApproaching
              ? 'bg-[hsl(var(--status-nominal))]'
              : 'bg-[hsl(var(--monitor-border))]'
            }
          `}
        />
        {!isNext && (
          <div className="w-0.5 h-6 bg-[hsl(var(--monitor-border))]" />
        )}
      </div>

      {/* Station info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`
              text-sm font-medium
              ${isNext
                ? 'text-[hsl(var(--monitor-accent-cyan))]'
                : 'text-[hsl(var(--monitor-text-primary))]'
              }
            `}
          >
            {stop.stationName}
          </span>
          {stop.isApproaching && (
            <span className="text-[10px] text-[hsl(var(--status-nominal))] font-medium uppercase">
              Approaching
            </span>
          )}
          {stop.isDelayed && (
            <span className="text-[10px] text-[hsl(var(--status-degraded))] font-medium uppercase">
              Delayed
            </span>
          )}
        </div>
        <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] truncate">
          {stop.stopDescription}
        </p>
      </div>

      {/* Time */}
      <div className="text-right">
        <p
          className={`
            monitor-mono text-sm font-medium
            ${stop.minutesAway <= 1
              ? 'text-[hsl(var(--status-nominal))]'
              : stop.isDelayed
              ? 'text-[hsl(var(--status-degraded))]'
              : 'text-[hsl(var(--monitor-text-primary))]'
            }
          `}
        >
          {stop.minutesAway <= 0 ? 'Due' : `${stop.minutesAway} min`}
        </p>
        {stop.isScheduled && (
          <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Scheduled</p>
        )}
      </div>
    </div>
  );
}

export function FollowTrainPanel({ runNumber, route, onClose }: FollowTrainPanelProps) {
  const { data, isLoading, error, refetch } = useTrainFollow(runNumber);
  const config = ROUTE_CONFIG[route];
  const train = data?.train;

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

      {/* Panel */}
      <div className="relative w-full max-w-md max-h-[85vh] bg-[hsl(var(--monitor-bg-secondary))] border border-[hsl(var(--monitor-border))] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header with route color accent */}
        <div
          className="p-4 border-b border-[hsl(var(--monitor-border))]"
          style={{ borderTopColor: config.color, borderTopWidth: 3 }}
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
                <Train className="h-5 w-5 text-[hsl(var(--monitor-accent-cyan))]" />
                <div>
                  <h2 className="monitor-mono text-lg font-bold text-[hsl(var(--monitor-text-primary))]">
                    Train #{runNumber}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${config.bgClass}`} />
                    <span className="text-xs text-[hsl(var(--monitor-text-secondary))]">
                      {config.name}
                    </span>
                  </div>
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

          {/* Live indicator */}
          <div className="mt-2 flex items-center gap-2">
            <Radio className="h-3 w-3 text-[hsl(var(--status-nominal))] animate-pulse" />
            <span className="text-[10px] text-[hsl(var(--status-nominal))] font-medium uppercase">
              Live Tracking
            </span>
            {data?.lastUpdated && (
              <span className="text-[10px] text-[hsl(var(--monitor-text-muted))]">
                Updated {new Date(data.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && !train && (
            <div className="space-y-4">
              <div className="animate-pulse h-24 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
              <div className="animate-pulse h-16 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
              <div className="animate-pulse h-16 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <AlertTriangle className="h-10 w-10 text-[hsl(var(--status-degraded))] mx-auto mb-3" />
              <p className="text-sm text-[hsl(var(--monitor-text-primary))] mb-1">
                Train Not Found
              </p>
              <p className="text-xs text-[hsl(var(--monitor-text-muted))] mb-4">
                {error instanceof Error ? error.message : 'This train may no longer be in service'}
              </p>
              <button
                onClick={() => refetch()}
                className="text-xs text-[hsl(var(--monitor-accent-cyan))] hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {train && (
            <>
              {/* Train status card */}
              <div className="p-4 bg-[hsl(var(--monitor-bg-tertiary))] rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] uppercase mb-1">
                      Destination
                    </p>
                    <p className="text-lg font-medium text-[hsl(var(--monitor-text-primary))]">
                      {train.destination}
                    </p>
                  </div>
                  {train.isDelayed && (
                    <span className="px-2 py-1 bg-[hsl(var(--status-degraded)/0.2)] text-[hsl(var(--status-degraded))] text-[10px] font-medium rounded">
                      DELAYED
                    </span>
                  )}
                </div>

                {/* Position info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
                    <div>
                      <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Position</p>
                      <p className="monitor-mono text-xs text-[hsl(var(--monitor-text-secondary))]">
                        {train.position.lat.toFixed(4)}, {train.position.lon.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Navigation
                      className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]"
                      style={{ transform: `rotate(${train.position.heading}deg)` }}
                    />
                    <div>
                      <p className="text-[10px] text-[hsl(var(--monitor-text-muted))]">Heading</p>
                      <p className="monitor-mono text-xs text-[hsl(var(--monitor-text-secondary))]">
                        {train.position.heading}° {getDirectionLabel(train.position.heading)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upcoming stops */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-[hsl(var(--monitor-accent-cyan))]" />
                  <span className="monitor-panel-title">UPCOMING STOPS</span>
                  <span className="text-xs text-[hsl(var(--monitor-text-muted))]">
                    ({train.upcomingStops.length})
                  </span>
                </div>

                {train.upcomingStops.length > 0 ? (
                  <div className="space-y-1">
                    {train.upcomingStops.map((stop, index) => (
                      <StopCard
                        key={`${stop.stationId}-${index}`}
                        stop={stop}
                        isNext={index === 0}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
                      No upcoming stops data
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
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

export default FollowTrainPanel;
