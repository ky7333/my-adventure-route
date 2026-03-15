import type { RoutePreferences, VehicleType } from '@adventure/contracts';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { planRoute } from '../lib/api';
import { toPlanRoutePayload } from '../lib/planPayload';

const defaultPreferences: RoutePreferences = {
  curvy: 70,
  scenic: 70,
  avoidHighways: 80,
  unpavedPreference: 45,
  difficulty: 50
};

export function PlanPage() {
  const [startLabel, setStartLabel] = useState('Burlington, VT');
  const [startLat, setStartLat] = useState('44.4759');
  const [startLng, setStartLng] = useState('-73.2121');
  const [endLabel, setEndLabel] = useState('Stowe, VT');
  const [endLat, setEndLat] = useState('44.4654');
  const [endLng, setEndLng] = useState('-72.6874');
  const [loopRide, setLoopRide] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>('adv_motorcycle');
  const [preferences, setPreferences] = useState<RoutePreferences>(defaultPreferences);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const setSlider = (key: keyof RoutePreferences, value: number): void => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = toPlanRoutePayload({
        startLabel,
        startLat,
        startLng,
        endLabel,
        endLat,
        endLng,
        loopRide,
        vehicleType,
        preferences
      });

      const response = await planRoute(payload);
      navigate(`/results/${response.routeRequestId}`);
    } catch (submissionError) {
      setError((submissionError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <h1>Plan your adventure route</h1>
      <p className="muted">Coordinates are currently required for MVP routing (label + lat/lng).</p>
      <form onSubmit={handleSubmit} className="planner-grid">
        <label>
          Start label
          <input value={startLabel} onChange={(event) => setStartLabel(event.target.value)} required />
        </label>
        <label>
          Start latitude
          <input value={startLat} onChange={(event) => setStartLat(event.target.value)} required />
        </label>
        <label>
          Start longitude
          <input value={startLng} onChange={(event) => setStartLng(event.target.value)} required />
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={loopRide} onChange={(event) => setLoopRide(event.target.checked)} />
          Loop ride (return to start)
        </label>

        <label>
          End label
          <input
            value={endLabel}
            onChange={(event) => setEndLabel(event.target.value)}
            required={!loopRide}
            disabled={loopRide}
          />
        </label>
        <label>
          End latitude
          <input
            value={endLat}
            onChange={(event) => setEndLat(event.target.value)}
            required={!loopRide}
            disabled={loopRide}
          />
        </label>
        <label>
          End longitude
          <input
            value={endLng}
            onChange={(event) => setEndLng(event.target.value)}
            required={!loopRide}
            disabled={loopRide}
          />
        </label>

        <label>
          Vehicle
          <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as VehicleType)}>
            <option value="motorcycle">Motorcycle</option>
            <option value="adv_motorcycle">ADV Motorcycle</option>
            <option value="4x4">4x4</option>
          </select>
        </label>

        <Slider
          label="Curvy"
          value={preferences.curvy}
          onChange={(value) => setSlider('curvy', value)}
        />
        <Slider
          label="Scenic"
          value={preferences.scenic}
          onChange={(value) => setSlider('scenic', value)}
        />
        <Slider
          label="Avoid highways"
          value={preferences.avoidHighways}
          onChange={(value) => setSlider('avoidHighways', value)}
        />
        <Slider
          label="Unpaved preference"
          value={preferences.unpavedPreference}
          onChange={(value) => setSlider('unpavedPreference', value)}
        />
        <Slider
          label="Difficulty"
          value={preferences.difficulty}
          onChange={(value) => setSlider('difficulty', value)}
        />

        {error && <p className="form-error">{error}</p>}

        <button className="btn-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Generating...' : 'Generate Routes'}
        </button>
      </form>
    </section>
  );
}

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, onChange }: SliderProps) {
  return (
    <label>
      {label}: {value}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
