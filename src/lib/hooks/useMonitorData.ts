// src/lib/hooks/useMonitorData.ts
'use client';

import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import type {
  SystemStatus,
  WeatherResponse,
  AlertsResponse,
  TrainPositionsResponse,
  RouteColor,
} from '@/lib/types/monitor';

// ============================================
// System Status Hook
// ============================================

export function useSystemStatus() {
  return useQuery<SystemStatus>({
    queryKey: ['monitor', 'status'],
    queryFn: async () => {
      const response = await fetch('/api/monitor/status');
      if (!response.ok) {
        throw new Error('Failed to fetch system status');
      }
      return response.json();
    },
    refetchInterval: 15000, // 15 seconds
    staleTime: 10000,
  });
}

// ============================================
// Weather Hook
// ============================================

export function useWeather() {
  return useQuery<WeatherResponse>({
    queryKey: ['monitor', 'weather'],
    queryFn: async () => {
      const response = await fetch('/api/monitor/weather');
      if (!response.ok) {
        throw new Error('Failed to fetch weather');
      }
      return response.json();
    },
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Alerts Hook
// ============================================

export function useAlerts(routes?: RouteColor[]) {
  const routeParam = routes?.length
    ? routes.map((r) => r.toLowerCase()).join(',')
    : '';

  return useQuery<AlertsResponse>({
    queryKey: ['monitor', 'alerts', routeParam],
    queryFn: async () => {
      const url = new URL('/api/monitor/alerts', window.location.origin);
      if (routeParam) {
        url.searchParams.set('routes', routeParam);
      }
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      return response.json();
    },
    refetchInterval: 60000, // 1 minute
    staleTime: 30000, // 30 seconds
  });
}

// ============================================
// Train Positions Hook
// ============================================

export function useTrainPositions(routes?: RouteColor[]) {
  const routeParam = routes?.length
    ? routes.map((r) => {
        // Map RouteColor to CTA API codes
        const codes: Record<RouteColor, string> = {
          Red: 'red',
          Blue: 'blue',
          Brn: 'brn',
          G: 'g',
          Org: 'org',
          P: 'p',
          Pink: 'pink',
          Y: 'y',
        };
        return codes[r];
      }).join(',')
    : '';

  return useQuery<TrainPositionsResponse>({
    queryKey: ['monitor', 'trains', 'positions', routeParam],
    queryFn: async () => {
      const url = new URL('/api/monitor/trains/positions', window.location.origin);
      if (routeParam) {
        url.searchParams.set('routes', routeParam);
      }
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch train positions');
      }
      return response.json();
    },
    refetchInterval: 15000, // 15 seconds
    staleTime: 10000, // 10 seconds
  });
}

// ============================================
// Combined Monitor Data Hook
// ============================================

interface UseMonitorDataOptions {
  enableWeather?: boolean;
  enableAlerts?: boolean;
  enableTrains?: boolean;
  routes?: RouteColor[];
}

export function useMonitorData(options: UseMonitorDataOptions = {}) {
  const {
    enableWeather = true,
    enableAlerts = true,
    enableTrains = true,
    routes,
  } = options;

  const queryClient = useQueryClient();

  const routeParam = routes?.length
    ? routes.map((r) => r.toLowerCase()).join(',')
    : '';

  const results = useQueries({
    queries: [
      // System status - always enabled
      {
        queryKey: ['monitor', 'status'],
        queryFn: async (): Promise<SystemStatus> => {
          const response = await fetch('/api/monitor/status');
          if (!response.ok) throw new Error('Failed to fetch status');
          return response.json();
        },
        refetchInterval: 15000,
        staleTime: 10000,
      },
      // Weather - optional
      {
        queryKey: ['monitor', 'weather'],
        queryFn: async (): Promise<WeatherResponse> => {
          const response = await fetch('/api/monitor/weather');
          if (!response.ok) throw new Error('Failed to fetch weather');
          return response.json();
        },
        refetchInterval: 10 * 60 * 1000,
        staleTime: 5 * 60 * 1000,
        enabled: enableWeather,
      },
      // Alerts - optional
      {
        queryKey: ['monitor', 'alerts', routeParam],
        queryFn: async (): Promise<AlertsResponse> => {
          const url = new URL('/api/monitor/alerts', window.location.origin);
          if (routeParam) url.searchParams.set('routes', routeParam);
          const response = await fetch(url.toString());
          if (!response.ok) throw new Error('Failed to fetch alerts');
          return response.json();
        },
        refetchInterval: 60000,
        staleTime: 30000,
        enabled: enableAlerts,
      },
      // Train positions - optional
      {
        queryKey: ['monitor', 'trains', 'positions', routeParam],
        queryFn: async (): Promise<TrainPositionsResponse> => {
          const url = new URL('/api/monitor/trains/positions', window.location.origin);
          if (routeParam) url.searchParams.set('routes', routeParam);
          const response = await fetch(url.toString());
          if (!response.ok) throw new Error('Failed to fetch trains');
          return response.json();
        },
        refetchInterval: 15000,
        staleTime: 10000,
        enabled: enableTrains,
      },
    ],
  });

  const [statusResult, weatherResult, alertsResult, trainsResult] = results;

  // Manual refresh function
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['monitor'] });
  };

  // Check if any query is loading
  const isLoading = results.some((r) => r.isLoading);
  const isRefetching = results.some((r) => r.isRefetching);

  // Get last update time (most recent of all queries)
  const lastUpdate = results
    .filter((r) => r.dataUpdatedAt > 0)
    .reduce((latest, r) => Math.max(latest, r.dataUpdatedAt), 0);

  return {
    // Individual data
    status: statusResult.data,
    weather: weatherResult.data,
    alerts: alertsResult.data,
    trains: trainsResult.data,

    // Loading states
    isLoading,
    isRefetching,
    statusLoading: statusResult.isLoading,
    weatherLoading: weatherResult.isLoading,
    alertsLoading: alertsResult.isLoading,
    trainsLoading: trainsResult.isLoading,

    // Errors
    statusError: statusResult.error,
    weatherError: weatherResult.error,
    alertsError: alertsResult.error,
    trainsError: trainsResult.error,

    // Timestamps
    lastUpdate: lastUpdate > 0 ? new Date(lastUpdate) : null,
    statusUpdatedAt: statusResult.dataUpdatedAt,
    weatherUpdatedAt: weatherResult.dataUpdatedAt,
    alertsUpdatedAt: alertsResult.dataUpdatedAt,
    trainsUpdatedAt: trainsResult.dataUpdatedAt,

    // Actions
    refresh,
  };
}

// ============================================
// Refresh Animation Hook
// ============================================

export function useRefreshTimestamp() {
  const { lastUpdate, isRefetching, refresh } = useMonitorData({
    enableWeather: false,
    enableAlerts: false,
    enableTrains: false,
  });

  return {
    lastUpdate,
    isRefreshing: isRefetching,
    refresh,
  };
}
