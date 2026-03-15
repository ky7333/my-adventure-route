import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteOptionsPanel } from './RouteOptionsPanel';

describe('RouteOptionsPanel', () => {
  it('renders three route cards with key stats', () => {
    render(
      <RouteOptionsPanel
        selectedRouteId="a1"
        onSelect={vi.fn()}
        options={[
          {
            id: 'a1',
            rank: 1,
            label: 'Primary Adventure',
            distanceKm: 100,
            durationMin: 140,
            twistinessScore: 80,
            difficultyScore: 60,
            surfaceMix: { pavedPercent: 60, gravelPercent: 30, dirtPercent: 8, unknownPercent: 2 },
            score: { curvature: 80, roadClass: 70, surface: 65, difficulty: 60, total: 75 },
            geometry: { type: 'LineString', coordinates: [[-72.7, 44.4], [-72.1, 44.8]] }
          },
          {
            id: 'a2',
            rank: 2,
            label: 'Alternative 1',
            distanceKm: 110,
            durationMin: 160,
            twistinessScore: 72,
            difficultyScore: 68,
            surfaceMix: { pavedPercent: 50, gravelPercent: 35, dirtPercent: 12, unknownPercent: 3 },
            score: { curvature: 72, roadClass: 68, surface: 70, difficulty: 64, total: 71 },
            geometry: { type: 'LineString', coordinates: [[-72.7, 44.4], [-72, 44.9]] }
          },
          {
            id: 'a3',
            rank: 3,
            label: 'Alternative 2',
            distanceKm: 125,
            durationMin: 180,
            twistinessScore: 69,
            difficultyScore: 71,
            surfaceMix: { pavedPercent: 40, gravelPercent: 40, dirtPercent: 17, unknownPercent: 3 },
            score: { curvature: 69, roadClass: 72, surface: 78, difficulty: 70, total: 70 },
            geometry: { type: 'LineString', coordinates: [[-72.7, 44.4], [-71.9, 44.6]] }
          }
        ]}
      />
    );

    expect(screen.getByText(/Route Options/i)).toBeInTheDocument();
    expect(screen.getByText(/Primary Adventure/i)).toBeInTheDocument();
    expect(screen.getByText(/Alternative 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Alternative 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Twistiness: 80/i)).toBeInTheDocument();
  });
});
