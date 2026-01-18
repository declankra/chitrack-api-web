// src/components/monitor/MonitorMapComponent.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl, { LngLatBoundsLike, LngLatLike } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Layers, X } from 'lucide-react';
import { useMonitor } from '@/lib/providers/MonitorProvider';
import type { Station, RouteColor } from '@/lib/types/cta';
import type { LiveTrain, MapLayerConfig } from '@/lib/types/monitor';

// Chicago coordinates and bounds
const CHICAGO_CENTER: [number, number] = [-87.6298, 41.8781];
const CHICAGO_BOUNDS: [[number, number], [number, number]] = [
  [-88.0, 41.6],
  [-87.2, 42.1],
];

// Route color mapping for hex values
const ROUTE_HEX_COLORS: Record<RouteColor, string> = {
  Red: '#c60c30',
  Blue: '#00a1de',
  Brn: '#62361b',
  G: '#009b3a',
  Org: '#f9461c',
  P: '#522398',
  Pink: '#e27ea6',
  Y: '#f9e300',
};

// Dark map style for monitor theme
const DARK_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

interface MonitorMapComponentProps {
  stations: Station[];
  trains: LiveTrain[];
  onStationSelect: (station: Station) => void;
  onTrainSelect?: (train: LiveTrain) => void;
  className?: string;
}

export function MonitorMapComponent({
  stations,
  trains,
  onStationSelect,
  onTrainSelect,
  className = '',
}: MonitorMapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const trainMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const { state, toggleLayer, setLayerEnabled } = useMonitor();
  const { mapLayers, mapFilters } = state;

  // Fetch Mapbox token
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/mapbox');
        if (!response.ok) {
          throw new Error(`Failed to fetch Mapbox token: ${response.status}`);
        }
        const data = await response.json();
        if (!data.token) {
          throw new Error('Received empty Mapbox token');
        }
        setMapboxToken(data.token);
        mapboxgl.accessToken = data.token;
      } catch (err) {
        console.error('Error fetching Mapbox token:', err);
        setError(`Failed to load map: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };
    fetchMapboxToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    try {
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: DARK_MAP_STYLE,
        center: CHICAGO_CENTER as LngLatLike,
        zoom: 11,
        maxBounds: CHICAGO_BOUNDS as LngLatBoundsLike,
        attributionControl: false,
        logoPosition: 'bottom-left',
      });

      map.current = mapInstance;

      mapInstance.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        'bottom-right'
      );

      mapInstance.on('load', async () => {
        try {
          // Load CTA lines GeoJSON
          const response = await fetch('/cta_lines_detailed.geojson');
          if (!response.ok) throw new Error('Failed to fetch GeoJSON');
          const ctaLinesData = await response.json();

          // Add transit lines source
          mapInstance.addSource('cta-lines', {
            type: 'geojson',
            data: ctaLinesData,
          });

          // Add layers for each line
          const lineNames = ['Red', 'Blue', 'Green', 'Brown', 'Purple', 'Yellow', 'Pink', 'Orange'];
          lineNames.forEach((lineName, index) => {
            const color = getLineColor(lineName);
            mapInstance.addLayer({
              id: `line-${lineName.toLowerCase()}`,
              type: 'line',
              source: 'cta-lines',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': color,
                'line-width': 3,
                'line-offset': (index - lineNames.length / 2 + 0.5) * 1.2,
                'line-opacity': 0.8,
              },
              filter: ['in', lineName, ['string', ['get', 'LINES']]],
            });
          });

          setIsMapReady(true);
          setIsLoading(false);
        } catch (fetchErr) {
          console.error('Error loading GeoJSON:', fetchErr);
          setError('Failed to load transit lines');
          setIsLoading(false);
        }
      });

      mapInstance.on('error', (e) => {
        console.error('Mapbox error:', e);
        if (!error) {
          setError(`Map error: ${e.error?.message || 'Unknown error'}`);
        }
        setIsLoading(false);
      });

      // Add custom styles for monitor theme
      addMapStyles();
    } catch (initErr) {
      console.error('Error initializing map:', initErr);
      setError(`Failed to initialize map: ${initErr instanceof Error ? initErr.message : 'Unknown error'}`);
      setIsLoading(false);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      trainMarkersRef.current.clear();
      removeMapStyles();
      setIsMapReady(false);
    };
  }, [mapboxToken]);

  // Update station markers
  useEffect(() => {
    if (!map.current || !isMapReady || !mapLayers.stations) return;

    // Remove existing station markers
    const existingMarkers = map.current.getContainer().querySelectorAll('.monitor-station-marker');
    existingMarkers.forEach((m) => m.remove());

    // Add station markers
    stations.forEach((station) => {
      if (!station.lat || !station.lon) return;

      const el = document.createElement('div');
      el.className = 'monitor-station-marker';
      el.style.cssText = `
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid hsl(230 15% 18%);
        cursor: pointer;
        transition: transform 0.2s ease;
      `;

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.5)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });
      el.addEventListener('click', () => {
        onStationSelect(station);
      });

      new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([station.lon, station.lat])
        .addTo(map.current!);
    });
  }, [stations, isMapReady, mapLayers.stations, onStationSelect]);

  // Update train markers
  useEffect(() => {
    if (!map.current || !isMapReady || !mapLayers.trains) return;

    const currentTrainIds = new Set(trains.map((t) => t.runNumber));
    const existingMarkerIds = new Set(trainMarkersRef.current.keys());

    // Remove markers for trains no longer present
    existingMarkerIds.forEach((id) => {
      if (!currentTrainIds.has(id)) {
        const marker = trainMarkersRef.current.get(id);
        marker?.remove();
        trainMarkersRef.current.delete(id);
      }
    });

    // Add or update train markers
    trains.forEach((train) => {
      // Skip if filtered out
      if (mapFilters.routes.length > 0 && !mapFilters.routes.includes(train.route)) {
        const existingMarker = trainMarkersRef.current.get(train.runNumber);
        if (existingMarker) {
          existingMarker.remove();
          trainMarkersRef.current.delete(train.runNumber);
        }
        return;
      }

      if (mapFilters.showDelayedOnly && !train.isDelayed) {
        const existingMarker = trainMarkersRef.current.get(train.runNumber);
        if (existingMarker) {
          existingMarker.remove();
          trainMarkersRef.current.delete(train.runNumber);
        }
        return;
      }

      const existingMarker = trainMarkersRef.current.get(train.runNumber);

      if (existingMarker) {
        // Update position
        existingMarker.setLngLat([train.lon, train.lat]);
        // Update rotation
        const el = existingMarker.getElement();
        const arrow = el.querySelector('.train-arrow') as HTMLElement;
        if (arrow) {
          arrow.style.transform = `rotate(${train.heading}deg)`;
        }
      } else {
        // Create new marker
        const el = createTrainMarkerElement(train, () => onTrainSelect?.(train));
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([train.lon, train.lat])
          .addTo(map.current!);
        trainMarkersRef.current.set(train.runNumber, marker);
      }
    });
  }, [trains, isMapReady, mapLayers.trains, mapFilters, onTrainSelect]);

  // Helper: Create train marker element
  const createTrainMarkerElement = (train: LiveTrain, onClick: () => void): HTMLElement => {
    const color = ROUTE_HEX_COLORS[train.route] || '#ffffff';

    const el = document.createElement('div');
    el.className = `monitor-train-marker ${train.isDelayed ? 'delayed' : ''}`;
    el.style.cssText = `
      width: 24px;
      height: 24px;
      position: relative;
      cursor: pointer;
    `;

    // Train dot
    const dot = document.createElement('div');
    dot.style.cssText = `
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid rgba(255,255,255,0.8);
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 ${train.isDelayed ? '10px' : '5px'} ${color};
    `;

    // Direction arrow
    const arrow = document.createElement('div');
    arrow.className = 'train-arrow';
    arrow.style.cssText = `
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 8px solid ${color};
      position: absolute;
      top: -4px;
      left: 50%;
      transform-origin: center bottom;
      transform: translateX(-50%) rotate(${train.heading}deg);
    `;

    el.appendChild(dot);
    el.appendChild(arrow);
    el.addEventListener('click', onClick);

    // Add tooltip
    el.title = `${train.route} Line - Run #${train.runNumber}\n→ ${train.destinationName}${train.isDelayed ? ' (DELAYED)' : ''}`;

    return el;
  };

  // Handle locate me
  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (map.current && isMapReady) {
            map.current.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: 15,
              essential: true,
            });
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to access your location.');
        }
      );
    }
  };

  return (
    <div className={`relative h-full w-full monitor-map ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--monitor-bg-primary)/0.8)] z-50">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-[hsl(var(--monitor-accent-cyan))] border-t-transparent rounded-full mx-auto mb-2" />
            <p className="monitor-mono text-sm text-[hsl(var(--monitor-text-secondary))]">
              Loading map...
            </p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div className="text-center p-4 bg-[hsl(var(--monitor-bg-secondary))] border border-[hsl(var(--status-critical)/0.5)] rounded-lg">
            <p className="text-[hsl(var(--status-critical))] font-medium mb-2">Map Error</p>
            <p className="text-sm text-[hsl(var(--monitor-text-secondary))] mb-3">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 bg-[hsl(var(--status-critical))] text-white rounded-md text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{ visibility: isMapReady ? 'visible' : 'hidden' }}
      />

      {/* Map controls */}
      {isMapReady && !error && (
        <>
          {/* Locate me button */}
          <button
            onClick={handleLocateMe}
            className="absolute top-4 right-4 z-10 p-2 bg-[hsl(var(--monitor-bg-secondary)/0.9)] border border-[hsl(var(--monitor-border))] rounded-lg hover:bg-[hsl(var(--monitor-bg-hover))] transition-colors"
            aria-label="Locate me"
          >
            <MapPin className="h-5 w-5 text-[hsl(var(--monitor-text-primary))]" />
          </button>

          {/* Layer toggle button */}
          <button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            className="absolute top-16 right-4 z-10 p-2 bg-[hsl(var(--monitor-bg-secondary)/0.9)] border border-[hsl(var(--monitor-border))] rounded-lg hover:bg-[hsl(var(--monitor-bg-hover))] transition-colors"
            aria-label="Toggle layers"
          >
            <Layers className="h-5 w-5 text-[hsl(var(--monitor-text-primary))]" />
          </button>

          {/* Layer panel */}
          {showLayerPanel && (
            <div className="absolute top-28 right-4 z-20 w-48 bg-[hsl(var(--monitor-bg-secondary))] border border-[hsl(var(--monitor-border))] rounded-lg shadow-lg">
              <div className="p-3 border-b border-[hsl(var(--monitor-border))] flex items-center justify-between">
                <span className="monitor-panel-title">LAYERS</span>
                <button onClick={() => setShowLayerPanel(false)}>
                  <X className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
                </button>
              </div>
              <div className="p-2 space-y-1">
                {(Object.keys(mapLayers) as Array<keyof MapLayerConfig>).map((layer) => (
                  <label
                    key={layer}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-[hsl(var(--monitor-bg-hover))] rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={mapLayers[layer]}
                      onChange={() => toggleLayer(layer)}
                      className="rounded border-[hsl(var(--monitor-border))]"
                    />
                    <span className="monitor-mono text-xs capitalize text-[hsl(var(--monitor-text-primary))]">
                      {layer}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Helper functions
function getLineColor(lineName: string): string {
  const colors: Record<string, string> = {
    Red: '#c60c30',
    Blue: '#00a1de',
    Brown: '#62361b',
    Green: '#009b3a',
    Orange: '#f9461c',
    Purple: '#522398',
    Pink: '#e27ea6',
    Yellow: '#f9e300',
  };
  return colors[lineName] || '#ffffff';
}

function addMapStyles() {
  if (!document.getElementById('monitor-map-styles')) {
    const style = document.createElement('style');
    style.id = 'monitor-map-styles';
    style.innerHTML = `
      .monitor-map .mapboxgl-ctrl-bottom-right {
        bottom: 80px !important;
        right: 10px !important;
      }
      .monitor-map .mapboxgl-ctrl-group {
        background: hsl(230 15% 8%) !important;
        border: 1px solid hsl(230 15% 18%) !important;
      }
      .monitor-map .mapboxgl-ctrl-group button {
        background-color: transparent !important;
      }
      .monitor-map .mapboxgl-ctrl-group button:hover {
        background-color: hsl(230 10% 16%) !important;
      }
      .monitor-map .mapboxgl-ctrl-group button span {
        filter: invert(1);
      }
      .monitor-map .mapboxgl-ctrl-logo {
        opacity: 0.5;
      }
    `;
    document.head.appendChild(style);
  }
}

function removeMapStyles() {
  const styleEl = document.getElementById('monitor-map-styles');
  if (styleEl) styleEl.remove();
}

export default MonitorMapComponent;
