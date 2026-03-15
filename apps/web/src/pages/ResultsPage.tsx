import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { RouteAlternative, RouteDetailResponse } from '@adventure/contracts';
import { RouteMap } from '../components/RouteMap';
import { RouteOptionsPanel } from '../components/RouteOptionsPanel';
import { fetchRoute } from '../lib/api';

export function ResultsPage() {
  const { routeRequestId } = useParams<{ routeRequestId: string }>();
  const [routeDetail, setRouteDetail] = useState<RouteDetailResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeRequestId) {
      return;
    }

    let isMounted = true;

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

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!routeDetail) {
    return <p>Loading route options...</p>;
  }

  return (
    <section className="results-layout">
      <div className="map-column">
        <RouteMap options={routeDetail.options} selectedRouteId={selectedRouteId} />
      </div>
      <div className="details-column">
        {selectedRoute && (
          <section className="stats-strip">
            <h1>Route Results</h1>
            <p>
              Distance: {selectedRoute.distanceKm.toFixed(1)} km | Time:{' '}
              {selectedRoute.durationMin.toFixed(0)} min | Twistiness: {selectedRoute.twistinessScore.toFixed(0)}
            </p>
          </section>
        )}
        <RouteOptionsPanel
          options={routeDetail.options}
          selectedRouteId={selectedRouteId}
          onSelect={setSelectedRouteId}
        />
      </div>
    </section>
  );
}
