// src/app/(app)/monitor/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo } from 'react';
import { useStations } from '@/lib/hooks/useStations';
import { useMonitorData } from '@/lib/hooks/useMonitorData';
import { useMonitor } from '@/lib/providers/MonitorProvider';
import { MonitorHeader } from '@/components/monitor/MonitorHeader';
import { BottomTicker } from '@/components/monitor/BottomTicker';
import { WeatherPanel } from '@/components/monitor/panels/WeatherPanel';
import { AlertsPanel } from '@/components/monitor/panels/AlertsPanel';
import { SocialFeedPanel } from '@/components/monitor/panels/SocialFeedPanel';
import { DelayAnalyticsPanel } from '@/components/monitor/panels/DelayAnalyticsPanel';
import { StationDetailModal } from '@/components/monitor/drilldown/StationDetailModal';
import { RouteDetailModal } from '@/components/monitor/drilldown/RouteDetailModal';
import { FollowTrainPanel } from '@/components/monitor/drilldown/FollowTrainPanel';
import type { Station } from '@/lib/types/cta';
import type { LiveTrain, RouteColor } from '@/lib/types/monitor';

// Dynamic import for map component to avoid SSR issues with mapbox
const MonitorMapComponent = dynamic(
  () => import('@/components/monitor/MonitorMapComponent'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-[hsl(var(--monitor-bg-primary))]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-[hsl(var(--monitor-accent-cyan))] border-t-transparent rounded-full mx-auto mb-2" />
          <p className="monitor-mono text-sm text-[hsl(var(--monitor-text-secondary))]">
            Loading map...
          </p>
        </div>
      </div>
    ),
  }
);

// Sidebar panel tabs
type SidebarPanel = 'alerts' | 'social' | 'stats';

export default function MonitorPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<SidebarPanel>('alerts');

  // Get stations data
  const { data: stations = [], isLoading: stationsLoading } = useStations();

  // Get monitor state
  const { state, openStationDetail, openRouteDetail, openTrainDetail, closeDrillDown, toggleSidebar } = useMonitor();
  const { sidebarCollapsed, mapFilters, drillDownType, drillDownId, selectedRoute } = state;

  // Get all monitor data
  const {
    status,
    weather,
    alerts,
    trains,
    isLoading,
    isRefetching,
    lastUpdate,
    refresh,
  } = useMonitorData({
    routes: mapFilters.routes.length > 0 ? mapFilters.routes : undefined,
  });

  // Determine system health status
  const systemStatus = status?.overall || 'nominal';

  // Handle station selection
  const handleStationSelect = useCallback((station: Station) => {
    openStationDetail(station.stationId);
  }, [openStationDetail]);

  // Handle train selection
  const handleTrainSelect = useCallback((train: LiveTrain) => {
    openTrainDetail(train.runNumber, train.route);
  }, [openTrainDetail]);

  // Handle line click from ticker
  const handleLineClick = useCallback((route: RouteColor) => {
    openRouteDetail(route);
  }, [openRouteDetail]);

  // Get selected station details for modal
  const selectedStation = useMemo(() => {
    if (drillDownType === 'station' && drillDownId) {
      return stations.find((s: Station) => s.stationId === drillDownId);
    }
    return null;
  }, [drillDownType, drillDownId, stations]);

  // Get lines for selected station
  const selectedStationLines = useMemo((): RouteColor[] => {
    if (!selectedStation) return [];
    // For simplicity, return an empty array - the modal will handle it
    // In a real implementation, you'd derive lines from station data
    return [];
  }, [selectedStation]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <MonitorHeader
        systemStatus={systemStatus}
        lastUpdate={lastUpdate}
        isRefreshing={isRefetching}
        onRefresh={refresh}
        onMenuClick={toggleSidebar}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map viewport */}
        <div className="flex-1 relative">
          <MonitorMapComponent
            stations={stations}
            trains={trains?.trains || []}
            onStationSelect={handleStationSelect}
            onTrainSelect={handleTrainSelect}
          />

          {/* Bottom ticker */}
          <BottomTicker
            lineStatuses={status?.lines || {}}
            onLineClick={handleLineClick}
          />
        </div>

        {/* Right sidebar - desktop only */}
        <div
          className={`
            hidden lg:flex flex-col w-80 border-l border-[hsl(var(--monitor-border))]
            bg-[hsl(var(--monitor-bg-secondary))]
            transition-all duration-300
            ${sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden' : ''}
          `}
        >
          {/* Weather Panel */}
          <div className="h-[280px] border-b border-[hsl(var(--monitor-border))]">
            <WeatherPanel
              data={weather || null}
              isLoading={!weather && isLoading}
            />
          </div>

          {/* Panel tabs */}
          <div className="flex border-b border-[hsl(var(--monitor-border))]">
            <button
              onClick={() => setActiveSidebarPanel('alerts')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeSidebarPanel === 'alerts'
                  ? 'text-[hsl(var(--monitor-accent-cyan))] border-b-2 border-[hsl(var(--monitor-accent-cyan))]'
                  : 'text-[hsl(var(--monitor-text-muted))] hover:text-[hsl(var(--monitor-text-secondary))]'
              }`}
            >
              Alerts
            </button>
            <button
              onClick={() => setActiveSidebarPanel('social')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeSidebarPanel === 'social'
                  ? 'text-[hsl(var(--monitor-accent-cyan))] border-b-2 border-[hsl(var(--monitor-accent-cyan))]'
                  : 'text-[hsl(var(--monitor-text-muted))] hover:text-[hsl(var(--monitor-text-secondary))]'
              }`}
            >
              Social
            </button>
            <button
              onClick={() => setActiveSidebarPanel('stats')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeSidebarPanel === 'stats'
                  ? 'text-[hsl(var(--monitor-accent-cyan))] border-b-2 border-[hsl(var(--monitor-accent-cyan))]'
                  : 'text-[hsl(var(--monitor-text-muted))] hover:text-[hsl(var(--monitor-text-secondary))]'
              }`}
            >
              Stats
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activeSidebarPanel === 'alerts' && (
              <AlertsPanel
                data={alerts || null}
                isLoading={!alerts && isLoading}
                onRefresh={refresh}
              />
            )}
            {activeSidebarPanel === 'social' && (
              <SocialFeedPanel onRefresh={refresh} />
            )}
            {activeSidebarPanel === 'stats' && (
              <DelayAnalyticsPanel
                data={status || null}
                isLoading={!status && isLoading}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {!sidebarCollapsed && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={toggleSidebar}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`
          lg:hidden fixed right-0 top-14 bottom-0 w-80 z-50
          bg-[hsl(var(--monitor-bg-secondary))] border-l border-[hsl(var(--monitor-border))]
          transform transition-transform duration-300
          ${sidebarCollapsed ? 'translate-x-full' : 'translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col">
          <div className="h-[280px] border-b border-[hsl(var(--monitor-border))]">
            <WeatherPanel
              data={weather || null}
              isLoading={!weather && isLoading}
            />
          </div>

          {/* Panel tabs - mobile */}
          <div className="flex border-b border-[hsl(var(--monitor-border))]">
            <button
              onClick={() => setActiveSidebarPanel('alerts')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeSidebarPanel === 'alerts'
                  ? 'text-[hsl(var(--monitor-accent-cyan))] border-b-2 border-[hsl(var(--monitor-accent-cyan))]'
                  : 'text-[hsl(var(--monitor-text-muted))] hover:text-[hsl(var(--monitor-text-secondary))]'
              }`}
            >
              Alerts
            </button>
            <button
              onClick={() => setActiveSidebarPanel('social')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeSidebarPanel === 'social'
                  ? 'text-[hsl(var(--monitor-accent-cyan))] border-b-2 border-[hsl(var(--monitor-accent-cyan))]'
                  : 'text-[hsl(var(--monitor-text-muted))] hover:text-[hsl(var(--monitor-text-secondary))]'
              }`}
            >
              Social
            </button>
            <button
              onClick={() => setActiveSidebarPanel('stats')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeSidebarPanel === 'stats'
                  ? 'text-[hsl(var(--monitor-accent-cyan))] border-b-2 border-[hsl(var(--monitor-accent-cyan))]'
                  : 'text-[hsl(var(--monitor-text-muted))] hover:text-[hsl(var(--monitor-text-secondary))]'
              }`}
            >
              Stats
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeSidebarPanel === 'alerts' && (
              <AlertsPanel
                data={alerts || null}
                isLoading={!alerts && isLoading}
                onRefresh={refresh}
              />
            )}
            {activeSidebarPanel === 'social' && (
              <SocialFeedPanel onRefresh={refresh} />
            )}
            {activeSidebarPanel === 'stats' && (
              <DelayAnalyticsPanel
                data={status || null}
                isLoading={!status && isLoading}
              />
            )}
          </div>
        </div>
      </div>

      {/* Drill-down modals */}
      {drillDownType === 'station' && drillDownId && selectedStation && (
        <StationDetailModal
          stationId={drillDownId}
          stationName={selectedStation.stationName}
          lines={selectedStationLines}
          onClose={closeDrillDown}
        />
      )}

      {drillDownType === 'route' && drillDownId && (
        <RouteDetailModal
          route={drillDownId as RouteColor}
          lineStatus={status?.lines?.[drillDownId as RouteColor]}
          onClose={closeDrillDown}
        />
      )}

      {drillDownType === 'train' && drillDownId && selectedRoute && (
        <FollowTrainPanel
          runNumber={drillDownId}
          route={selectedRoute}
          onClose={closeDrillDown}
        />
      )}
    </div>
  );
}
