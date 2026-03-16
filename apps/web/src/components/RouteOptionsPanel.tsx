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
      <div className="results-panel-header">
        <h2>Route Options</h2>
        <span className="route-count-pill">{options.length} choices</span>
      </div>
      <div className="route-segmented" role="tablist" aria-label="Choose route">
        {options.map((option) => (
          <button
            key={`${option.id}-chip`}
            type="button"
            role="tab"
            aria-selected={selectedRouteId === option.id}
            className={`route-chip ${selectedRouteId === option.id ? 'active' : ''}`}
            onClick={() => onSelect(option.id)}
          >
            <span className="route-chip-rank">Route {option.rank}</span>
            <span className="route-chip-time">{option.durationMin.toFixed(0)} min</span>
          </button>
        ))}
      </div>
      <div className="route-options-grid">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`route-card ${selectedRouteId === option.id ? 'active' : ''}`}
            onClick={() => onSelect(option.id)}
          >
            <div className="route-card-head">
              <div className="route-card-title">#{option.rank} {option.label}</div>
              <span className="route-card-time">{option.durationMin.toFixed(0)} min</span>
            </div>
            <div className="route-quick-stats">
              <span>{option.distanceKm.toFixed(1)} km</span>
              <span>Twistiness: {option.twistinessScore.toFixed(0)}</span>
              <span>Difficulty: {option.difficultyScore.toFixed(0)}</span>
            </div>
            <div className="route-surface-pills">
              <span className="surface-pill surface-pill-paved">Paved {option.surfaceMix.pavedPercent}%</span>
              <span className="surface-pill surface-pill-gravel">Gravel {option.surfaceMix.gravelPercent}%</span>
              <span className="surface-pill surface-pill-dirt">Dirt {option.surfaceMix.dirtPercent}%</span>
              <span className="surface-pill surface-pill-unknown">Unknown {option.surfaceMix.unknownPercent}%</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
