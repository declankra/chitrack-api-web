// src/lib/providers/MonitorProvider.tsx
'use client';

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { RouteColor, MapLayerConfig, MapFilter, MonitorState } from '@/lib/types/monitor';

// ============================================
// Actions
// ============================================

type MonitorAction =
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_ACTIVE_PANEL'; panel: MonitorState['activePanel'] }
  | { type: 'SET_MAP_LAYER'; layer: keyof MapLayerConfig; enabled: boolean }
  | { type: 'SET_MAP_FILTER'; filter: Partial<MapFilter> }
  | { type: 'SET_MAP_VIEW'; center?: [number, number]; zoom?: number }
  | { type: 'SELECT_STATION'; stationId: string | null }
  | { type: 'SELECT_ROUTE'; route: RouteColor | null }
  | { type: 'SELECT_TRAIN'; runNumber: string | null }
  | { type: 'OPEN_DRILL_DOWN'; drillType: 'station' | 'route' | 'train'; id: string; route?: RouteColor }
  | { type: 'CLOSE_DRILL_DOWN' }
  | { type: 'SET_AUTO_REFRESH'; enabled: boolean }
  | { type: 'UPDATE_LAST_REFRESH'; key: string; time: Date };

// ============================================
// Context Value Interface
// ============================================

interface MonitorContextValue {
  state: MonitorState;
  dispatch: React.Dispatch<MonitorAction>;

  // Convenience methods
  toggleSidebar: () => void;
  setActivePanel: (panel: MonitorState['activePanel']) => void;
  toggleLayer: (layer: keyof MapLayerConfig) => void;
  setLayerEnabled: (layer: keyof MapLayerConfig, enabled: boolean) => void;
  filterByRoute: (route: RouteColor) => void;
  toggleRouteFilter: (route: RouteColor) => void;
  clearFilters: () => void;
  selectStation: (stationId: string | null) => void;
  selectRoute: (route: RouteColor | null) => void;
  selectTrain: (runNumber: string | null) => void;
  openStationDetail: (stationId: string) => void;
  openRouteDetail: (route: RouteColor) => void;
  openTrainDetail: (runNumber: string, route: RouteColor) => void;
  closeDrillDown: () => void;
  setAutoRefresh: (enabled: boolean) => void;
  setMapView: (center?: [number, number], zoom?: number) => void;
}

// ============================================
// Initial State
// ============================================

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
  mapCenter: [-87.6298, 41.8781], // Chicago center
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

// ============================================
// Reducer
// ============================================

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

    case 'SET_MAP_VIEW':
      return {
        ...state,
        ...(action.center && { mapCenter: action.center }),
        ...(action.zoom !== undefined && { mapZoom: action.zoom }),
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
        drillDownType: action.drillType,
        drillDownId: action.id,
        ...(action.route && { selectedRoute: action.route }),
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

// ============================================
// Context
// ============================================

const MonitorContext = createContext<MonitorContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

export function MonitorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(monitorReducer, initialState);

  // Convenience methods
  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const setActivePanel = useCallback((panel: MonitorState['activePanel']) => {
    dispatch({ type: 'SET_ACTIVE_PANEL', panel });
  }, []);

  const toggleLayer = useCallback((layer: keyof MapLayerConfig) => {
    dispatch({ type: 'SET_MAP_LAYER', layer, enabled: !state.mapLayers[layer] });
  }, [state.mapLayers]);

  const setLayerEnabled = useCallback((layer: keyof MapLayerConfig, enabled: boolean) => {
    dispatch({ type: 'SET_MAP_LAYER', layer, enabled });
  }, []);

  const filterByRoute = useCallback((route: RouteColor) => {
    // Set filter to only show this route
    dispatch({ type: 'SET_MAP_FILTER', filter: { routes: [route] } });
  }, []);

  const toggleRouteFilter = useCallback((route: RouteColor) => {
    const currentRoutes = state.mapFilters.routes;
    const newRoutes = currentRoutes.includes(route)
      ? currentRoutes.filter(r => r !== route)
      : [...currentRoutes, route];
    dispatch({ type: 'SET_MAP_FILTER', filter: { routes: newRoutes } });
  }, [state.mapFilters.routes]);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'SET_MAP_FILTER', filter: { routes: [], showDelayedOnly: false } });
  }, []);

  const selectStation = useCallback((stationId: string | null) => {
    dispatch({ type: 'SELECT_STATION', stationId });
  }, []);

  const selectRoute = useCallback((route: RouteColor | null) => {
    dispatch({ type: 'SELECT_ROUTE', route });
  }, []);

  const selectTrain = useCallback((runNumber: string | null) => {
    dispatch({ type: 'SELECT_TRAIN', runNumber });
  }, []);

  const openStationDetail = useCallback((stationId: string) => {
    dispatch({ type: 'OPEN_DRILL_DOWN', drillType: 'station', id: stationId });
  }, []);

  const openRouteDetail = useCallback((route: RouteColor) => {
    dispatch({ type: 'OPEN_DRILL_DOWN', drillType: 'route', id: route });
  }, []);

  const openTrainDetail = useCallback((runNumber: string, route: RouteColor) => {
    dispatch({ type: 'OPEN_DRILL_DOWN', drillType: 'train', id: runNumber, route });
  }, []);

  const closeDrillDown = useCallback(() => {
    dispatch({ type: 'CLOSE_DRILL_DOWN' });
  }, []);

  const setAutoRefresh = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_AUTO_REFRESH', enabled });
  }, []);

  const setMapView = useCallback((center?: [number, number], zoom?: number) => {
    dispatch({ type: 'SET_MAP_VIEW', center, zoom });
  }, []);

  return (
    <MonitorContext.Provider value={{
      state,
      dispatch,
      toggleSidebar,
      setActivePanel,
      toggleLayer,
      setLayerEnabled,
      filterByRoute,
      toggleRouteFilter,
      clearFilters,
      selectStation,
      selectRoute,
      selectTrain,
      openStationDetail,
      openRouteDetail,
      openTrainDetail,
      closeDrillDown,
      setAutoRefresh,
      setMapView,
    }}>
      {children}
    </MonitorContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useMonitor() {
  const context = useContext(MonitorContext);
  if (!context) {
    throw new Error('useMonitor must be used within MonitorProvider');
  }
  return context;
}
