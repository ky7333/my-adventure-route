import type { RouteAlternative } from '@adventure/contracts';

interface RouteOptionsPanelProps {
  options: RouteAlternative[];
  selectedRouteId: string | null;
  onSelect: (routeId: string) => void;
}

export function RouteOptionsPanel({
  options,
  selectedRouteId,
  onSelect
}: RouteOptionsPanelProps) {
  return (
    <section className="results-panel">
      <h2>Route Options</h2>
      <div className="route-options-grid">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`route-card ${selectedRouteId === option.id ? 'active' : ''}`}
            onClick={() => onSelect(option.id)}
          >
            <div className="route-card-title">#{option.rank} {option.label}</div>
            <div>{option.distanceKm.toFixed(1)} km</div>
            <div>{option.durationMin.toFixed(0)} min</div>
            <div>Twistiness: {option.twistinessScore.toFixed(0)}</div>
            <div>
              Surface mix: paved {option.surfaceMix.pavedPercent}% / gravel {option.surfaceMix.gravelPercent}%
              {' '} / dirt {option.surfaceMix.dirtPercent}% / unknown {option.surfaceMix.unknownPercent}%
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
