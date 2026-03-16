import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { RouteAlternative, RouteDetailResponse } from '@adventure/contracts';
import { RouteMap } from '../components/RouteMap';
import { RouteOptionsPanel } from '../components/RouteOptionsPanel';
import { fetchRoute } from '../lib/api';

interface FitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const BASE_PADDING = 40;

export function ResultsPage() {
  const { routeRequestId } = useParams<{ routeRequestId: string }>();
  const [routeDetail, setRouteDetail] = useState<RouteDetailResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fitPadding, setFitPadding] = useState<FitPadding>({
    top: BASE_PADDING,
    right: BASE_PADDING,
    bottom: BASE_PADDING,
    left: BASE_PADDING
  });
  const layoutRef = useRef<HTMLElement | null>(null);
  const floatingPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!routeRequestId) {
      return;
    }

    let isMounted = true;
    setError(null);
    setRouteDetail(null);
    setSelectedRouteId(null);

    fetchRoute(routeRequestId)
      .then((response) => {
        if (!isMounted) return;
        setRouteDetail(response);
        setSelectedRouteId(response.options[0]?.id ?? null);
      })
      .catch((requestError) => {
        if (!isMounted) return;
        setError((requestError as Error).message);
      });

    return () => {
      isMounted = false;
    };
  }, [routeRequestId]);

  const selectedRoute = useMemo<RouteAlternative | null>(() => {
    if (!routeDetail?.options.length) {
      return null;
    }
    return (
      routeDetail.options.find((option) => option.id === selectedRouteId) ?? routeDetail.options[0] ?? null
    );
  }, [routeDetail, selectedRouteId]);

  useEffect(() => {
    if (!routeDetail) {
      return;
    }

    const layout = layoutRef.current;
    const panel = floatingPanelRef.current;
    if (!layout || !panel) {
      return;
    }

    const updateFitPadding = (): void => {
      const layoutRect = layout.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const overlapWidth = Math.max(0, Math.min(layoutRect.right, panelRect.right) - layoutRect.left);
      const overlapHeight = Math.max(0, Math.min(layoutRect.bottom, panelRect.bottom) - layoutRect.top);
      const isNarrowLayout = overlapWidth > layoutRect.width * 0.55;
      const maxTopPadding = Math.max(BASE_PADDING, Math.round(layoutRect.height - 80));
      const maxLeftPadding = Math.max(BASE_PADDING, Math.round(layoutRect.width - 80));

      const nextPadding = isNarrowLayout
        ? {
            top: Math.min(maxTopPadding, Math.max(BASE_PADDING, Math.round(overlapHeight + 20))),
            right: BASE_PADDING,
            bottom: BASE_PADDING,
            left: BASE_PADDING
          }
        : {
            top: BASE_PADDING,
            right: BASE_PADDING,
            bottom: BASE_PADDING,
            left: Math.min(maxLeftPadding, Math.max(BASE_PADDING, Math.round(overlapWidth + 20)))
          };

      setFitPadding((current) => {
        if (
          current.top === nextPadding.top &&
          current.right === nextPadding.right &&
          current.bottom === nextPadding.bottom &&
          current.left === nextPadding.left
        ) {
          return current;
        }
        return nextPadding;
      });
    };

    updateFitPadding();
    const resizeObserver = new ResizeObserver(updateFitPadding);
    resizeObserver.observe(layout);
    resizeObserver.observe(panel);
    window.addEventListener('resize', updateFitPadding);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateFitPadding);
    };
  }, [routeDetail?.routeRequestId]);

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!routeDetail) {
    return <p>Loading route options...</p>;
  }

  const destinationLabel = routeDetail.loopRide
    ? `${routeDetail.start.label} (loop)`
    : routeDetail.end?.label ?? 'Destination';

  return (
    <section className="map-results-layout" ref={layoutRef}>
      <RouteMap options={routeDetail.options} selectedRouteId={selectedRouteId} fitPadding={fitPadding} />
      <aside className="floating-route-panel" aria-label="Route controls" ref={floatingPanelRef}>
        <section className="from-to-card">
          <h1>Route Planner</h1>
          <div className="from-to-lines">
            <div className="from-to-line">
              <span className="from-to-pin from-to-pin-start" aria-hidden />
              <div className="from-to-copy">
                <span className="from-to-label">From</span>
                <span className="from-to-value">{routeDetail.start.label}</span>
              </div>
            </div>
            <div className="from-to-line">
              <span className="from-to-pin from-to-pin-end" aria-hidden />
              <div className="from-to-copy">
                <span className="from-to-label">To</span>
                <span className="from-to-value">{destinationLabel}</span>
              </div>
            </div>
          </div>
          {selectedRoute && (
            <p className="from-to-stats">
              Selected: {selectedRoute.distanceKm.toFixed(1)} km • {selectedRoute.durationMin.toFixed(0)} min
            </p>
          )}
        </section>
        <RouteOptionsPanel
          options={routeDetail.options}
          selectedRouteId={selectedRouteId}
          onSelect={setSelectedRouteId}
        />
      </aside>
    </section>
  );
}
