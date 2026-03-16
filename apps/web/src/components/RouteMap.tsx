import type { GeoJSONSource, LngLatBounds as MapLibreLngLatBounds, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { RouteAlternative, RouteSurfaceSection, RouteSurfaceType } from '@adventure/contracts';

interface RouteMapProps {
  options: RouteAlternative[];
  selectedRouteId: string | null;
  fitPadding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

const SURFACE_COLORS: Record<RouteSurfaceType, string> = {
  paved: '#2e7d32',
  gravel: '#b7791f',
  dirt: '#8d4f2b',
  unknown: '#6b7280'
};

interface MapLibreGlobal {
  Map: new (options: Record<string, unknown>) => MapLibreMap;
  NavigationControl: new () => Parameters<MapLibreMap['addControl']>[0];
  LngLatBounds: new () => MapLibreLngLatBounds;
}

declare global {
  interface Window {
    maplibregl?: MapLibreGlobal;
  }
}

function estimateSurfaceSections(option: RouteAlternative): RouteSurfaceSection[] {
  const edgeCount = option.geometry.coordinates.length - 1;
  if (edgeCount <= 0) {
    return [];
  }

  const weightedSurfaces: Array<{ surface: RouteSurfaceType; value: number }> = [
    { surface: 'paved', value: option.surfaceMix.pavedPercent },
    { surface: 'gravel', value: option.surfaceMix.gravelPercent },
    { surface: 'dirt', value: option.surfaceMix.dirtPercent },
    { surface: 'unknown', value: option.surfaceMix.unknownPercent }
  ].filter((entry): entry is { surface: RouteSurfaceType; value: number } => entry.value > 0);

  if (!weightedSurfaces.length) {
    return [{ startCoordinateIndex: 0, endCoordinateIndex: edgeCount, surface: 'unknown' }];
  }

  const rawEdgeCounts = weightedSurfaces.map((entry) => (entry.value / 100) * edgeCount);
  const edgeCounts = rawEdgeCounts.map((value) => Math.floor(value));
  let remaining = edgeCount - edgeCounts.reduce((sum, value) => sum + value, 0);

  const remainders = rawEdgeCounts
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < remainders.length && remaining > 0; i += 1) {
    const targetIndex = remainders[i]?.index;
    if (targetIndex === undefined) {
      continue;
    }
    edgeCounts[targetIndex] = (edgeCounts[targetIndex] ?? 0) + 1;
    remaining -= 1;
  }

  const sections: RouteSurfaceSection[] = [];
  let cursor = 0;

  for (let index = 0; index < weightedSurfaces.length; index += 1) {
    const entry = weightedSurfaces[index];
    const count = edgeCounts[index] ?? 0;
    if (!entry || count <= 0) {
      continue;
    }

    const startCoordinateIndex = cursor;
    const endCoordinateIndex = Math.min(edgeCount, cursor + count);
    cursor = endCoordinateIndex;
    sections.push({
      startCoordinateIndex,
      endCoordinateIndex,
      surface: entry.surface
    });
  }

  if (!sections.length) {
    return [{ startCoordinateIndex: 0, endCoordinateIndex: edgeCount, surface: 'unknown' }];
  }

  const last = sections[sections.length - 1];
  if (last && last.endCoordinateIndex < edgeCount) {
    last.endCoordinateIndex = edgeCount;
  }

  return sections;
}

function buildSurfaceFeatures(option: RouteAlternative) {
  const coordinates = option.geometry.coordinates;
  const candidateSections = option.surfaceSections?.length
    ? option.surfaceSections
    : estimateSurfaceSections(option);

  const features = candidateSections
    .map((section) => {
      const start = Math.max(0, Math.min(section.startCoordinateIndex, coordinates.length - 2));
      const end = Math.max(start + 1, Math.min(section.endCoordinateIndex, coordinates.length - 1));
      const sectionCoordinates = coordinates.slice(start, end + 1);

      if (sectionCoordinates.length < 2) {
        return null;
      }

      return {
        type: 'Feature' as const,
        properties: {
          surface: section.surface
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: sectionCoordinates
        }
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null);

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

const DEFAULT_FIT_PADDING = {
  top: 40,
  right: 40,
  bottom: 40,
  left: 40
};

export function RouteMap({ options, selectedRouteId, fitPadding }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreGlobal | null>(null);
  const lastFittedRouteIdRef = useRef<string | null>(null);
  const lastFitPaddingKeyRef = useRef<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initMap = async (): Promise<void> => {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      if (!window.maplibregl) {
        await import('maplibre-gl/dist/maplibre-gl.js');
      }

      const maplibre = window.maplibregl;
      if (!maplibre || cancelled || !containerRef.current || mapRef.current) {
        return;
      }

      maplibreRef.current = maplibre;
      mapRef.current = new maplibre.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm'
            }
          ]
        },
        center: [-72.7, 44.4],
        zoom: 8
      });

      mapRef.current.addControl(new maplibre.NavigationControl(), 'top-right');
      setIsMapReady(true);
    };

    void initMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !isMapReady) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 8;

    const renderSelectedRoute = (): void => {
      if (cancelled) {
        return;
      }

      const baseSourceId = 'selected-route-base';
      const baseLayerId = 'selected-route-base-line';
      const surfaceSourceId = 'selected-route-surfaces';
      const surfaceLayerId = 'selected-route-surfaces-line';
      const clearRenderedRoute = (): void => {
        const emptyFeatureCollection = {
          type: 'FeatureCollection' as const,
          features: []
        };
        const baseSource = map.getSource(baseSourceId);
        if (baseSource) {
          (baseSource as GeoJSONSource).setData(emptyFeatureCollection as any);
        }
        const surfaceSource = map.getSource(surfaceSourceId);
        if (surfaceSource) {
          (surfaceSource as GeoJSONSource).setData(emptyFeatureCollection as any);
        }
        lastFittedRouteIdRef.current = null;
        lastFitPaddingKeyRef.current = null;
        retryCount = 0;
      };

      const selected = options.find((option) => option.id === selectedRouteId) ?? options[0];
      if (!selected || selected.geometry.coordinates.length < 2) {
        clearRenderedRoute();
        return;
      }

      if (!map.isStyleLoaded()) {
        scheduleRetry();
        return;
      }

      const sourceData = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: selected.geometry
          }
        ]
      };
      const surfaceData = buildSurfaceFeatures(selected);

      try {
        if (map.getSource(baseSourceId)) {
          (map.getSource(baseSourceId) as GeoJSONSource).setData(sourceData as any);
        } else {
          map.addSource(baseSourceId, {
            type: 'geojson',
            data: sourceData as any
          });
        }

        if (!map.getLayer(baseLayerId)) {
          map.addLayer({
            id: baseLayerId,
            type: 'line',
            source: baseSourceId,
            paint: {
              'line-color': '#1f2937',
              'line-width': 9,
              'line-opacity': 0.35
            }
          });
        }

        if (map.getSource(surfaceSourceId)) {
          (map.getSource(surfaceSourceId) as GeoJSONSource).setData(surfaceData as any);
        } else {
          map.addSource(surfaceSourceId, {
            type: 'geojson',
            data: surfaceData as any
          });
        }

        if (!map.getLayer(surfaceLayerId)) {
          map.addLayer({
            id: surfaceLayerId,
            type: 'line',
            source: surfaceSourceId,
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': [
                'match',
                ['get', 'surface'],
                'paved',
                SURFACE_COLORS.paved,
                'gravel',
                SURFACE_COLORS.gravel,
                'dirt',
                SURFACE_COLORS.dirt,
                SURFACE_COLORS.unknown
              ],
              'line-width': 6,
              'line-opacity': 0.95
            }
          });
        }
      } catch (error) {
        console.warn('RouteMap: failed to render selected route layer, retrying.', error);
        scheduleRetry();
        return;
      }

      retryCount = 0;

      const resolvedFitPadding = fitPadding ?? DEFAULT_FIT_PADDING;
      const fitPaddingKey = `${resolvedFitPadding.top}:${resolvedFitPadding.right}:${resolvedFitPadding.bottom}:${resolvedFitPadding.left}`;
      if (lastFittedRouteIdRef.current !== selected.id || lastFitPaddingKeyRef.current !== fitPaddingKey) {
        const bounds = new maplibre.LngLatBounds();
        selected.geometry.coordinates.forEach(([lng, lat]) => {
          bounds.extend([lng, lat]);
        });
        map.fitBounds(bounds, { padding: resolvedFitPadding, duration: 300 });
        lastFittedRouteIdRef.current = selected.id;
        lastFitPaddingKeyRef.current = fitPaddingKey;
      }
    };

    const scheduleRetry = (): void => {
      if (cancelled || retryTimer) {
        return;
      }

      if (retryCount >= MAX_RETRIES) {
        console.warn('RouteMap: max render retries reached; aborting route render retries.');
        return;
      }

      retryCount += 1;

      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (cancelled) {
          return;
        }
        renderSelectedRoute();
      }, 150);
    };

    renderSelectedRoute();
    map.on('load', renderSelectedRoute);
    map.on('styledata', renderSelectedRoute);
    return () => {
      cancelled = true;
      retryCount = 0;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      map.off('load', renderSelectedRoute);
      map.off('styledata', renderSelectedRoute);
    };
  }, [options, selectedRouteId, isMapReady, fitPadding]);

  return (
    <div className="route-map-shell">
      <div className="route-map" ref={containerRef} />
      <div className="surface-legend">
        <span className="legend-item">
          <i className="legend-swatch legend-paved" />
          Paved
        </span>
        <span className="legend-item">
          <i className="legend-swatch legend-gravel" />
          Gravel
        </span>
        <span className="legend-item">
          <i className="legend-swatch legend-dirt" />
          Dirt
        </span>
        <span className="legend-item">
          <i className="legend-swatch legend-unknown" />
          Unknown
        </span>
      </div>
    </div>
  );
}
