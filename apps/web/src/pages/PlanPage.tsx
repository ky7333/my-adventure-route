import type {
  PlanRouteRequest,
  RouteAlternative,
  RouteDetailResponse,
  RoutePreferences,
  VehicleType
} from '@adventure/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AddressAutocompleteField } from '../components/AddressAutocompleteField';
import { RouteMap } from '../components/RouteMap';
import { RouteOptionsPanel } from '../components/RouteOptionsPanel';
import { fetchRoute, planRoute } from '../lib/api';
import { formatRouteDistance } from '../lib/formatDistance';
import { formatRouteDuration } from '../lib/formatDuration';
import { geocodeAddress, type GeocodeOption } from '../lib/geocoding';

const defaultPreferences: RoutePreferences = {
  curvy: 70,
  scenic: 70,
  avoidHighways: 80,
  unpavedPreference: 45,
  difficulty: 50,
  distanceInfluence: 18
};

const CUSTOM_ROUTE_PROFILE_ID = 'custom' as const;

const ROUTE_PREFERENCE_PROFILES = [
  {
    id: 'balanced_adventure',
    label: 'Balanced Adventure',
    preferences: defaultPreferences
  },
  {
    id: 'twisty_paved',
    label: 'Twisty Paved',
    preferences: {
      curvy: 90,
      scenic: 60,
      avoidHighways: 75,
      unpavedPreference: 20,
      difficulty: 55,
      distanceInfluence: 22
    }
  },
  {
    id: 'scenic_backroads',
    label: 'Scenic Backroads',
    preferences: {
      curvy: 65,
      scenic: 95,
      avoidHighways: 85,
      unpavedPreference: 35,
      difficulty: 45,
      distanceInfluence: 20
    }
  },
  {
    id: 'dual_sport_mixed',
    label: 'Dual-Sport Mixed Surface',
    preferences: {
      curvy: 75,
      scenic: 70,
      avoidHighways: 80,
      unpavedPreference: 85,
      difficulty: 80,
      distanceInfluence: 15
    }
  },
  {
    id: 'easy_cruise',
    label: 'Easy Cruise',
    preferences: {
      curvy: 40,
      scenic: 65,
      avoidHighways: 40,
      unpavedPreference: 10,
      difficulty: 25,
      distanceInfluence: 26
    }
  }
] as const;

type RoutePreferenceProfileId = (typeof ROUTE_PREFERENCE_PROFILES)[number]['id'] | typeof CUSTOM_ROUTE_PROFILE_ID;

interface FitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const BASE_PADDING = 40;
const AUTO_PLAN_DEBOUNCE_MS = 550;

function preferencesMatch(left: RoutePreferences, right: RoutePreferences): boolean {
  return (
    left.curvy === right.curvy &&
    left.scenic === right.scenic &&
    left.avoidHighways === right.avoidHighways &&
    left.unpavedPreference === right.unpavedPreference &&
    left.difficulty === right.difficulty &&
    left.distanceInfluence === right.distanceInfluence
  );
}

function resolveRoutePreferenceProfile(preferences: RoutePreferences): RoutePreferenceProfileId {
  const matched = ROUTE_PREFERENCE_PROFILES.find((profile) =>
    preferencesMatch(profile.preferences, preferences)
  );
  return matched?.id ?? CUSTOM_ROUTE_PROFILE_ID;
}

function toErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return 'Unexpected error while planning route';
}

function matchesSelectedOptionLabel(option: GeocodeOption | null, label: string): option is GeocodeOption {
  return option !== null && option.label.trim().toLowerCase() === label.trim().toLowerCase();
}

function coordinateKey(option: GeocodeOption | null, label: string): string {
  if (!matchesSelectedOptionLabel(option, label)) {
    return '';
  }
  return `${option.lat.toFixed(6)},${option.lng.toFixed(6)}`;
}

function coordinateLabel(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function computeAutoPlanSignature(input: {
  startLabel: string;
  endLabel: string;
  loopRide: boolean;
  vehicleType: VehicleType;
  preferences: RoutePreferences;
  selectedStartOption: GeocodeOption | null;
  selectedEndOption: GeocodeOption | null;
}): string {
  const startAddress = input.startLabel.trim();
  const destinationAddress = input.endLabel.trim();
  const startCoordinate = coordinateKey(input.selectedStartOption, startAddress);
  const endCoordinate = input.loopRide
    ? ''
    : coordinateKey(input.selectedEndOption, destinationAddress);

  return JSON.stringify({
    startAddress: startAddress.toLowerCase(),
    destinationAddress: input.loopRide ? '' : destinationAddress.toLowerCase(),
    loopRide: input.loopRide,
    vehicleType: input.vehicleType,
    preferences: input.preferences,
    startCoordinateKey: startCoordinate,
    endCoordinateKey: endCoordinate
  });
}

export function PlanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeRequestId = searchParams.get('routeRequestId');
  const [startLabel, setStartLabel] = useState('Burlington, VT');
  const [selectedStartOption, setSelectedStartOption] = useState<GeocodeOption | null>(null);
  const [endLabel, setEndLabel] = useState('Stowe, VT');
  const [selectedEndOption, setSelectedEndOption] = useState<GeocodeOption | null>(null);
  const [loopRide, setLoopRide] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>('adv_motorcycle');
  const [preferences, setPreferences] = useState<RoutePreferences>(defaultPreferences);
  const [routePreferenceProfile, setRoutePreferenceProfile] = useState<RoutePreferenceProfileId>(
    resolveRoutePreferenceProfile(defaultPreferences)
  );
  const [routeDetail, setRouteDetail] = useState<RouteDetailResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fitPadding, setFitPadding] = useState<FitPadding>({
    top: BASE_PADDING,
    right: BASE_PADDING,
    bottom: BASE_PADDING,
    left: BASE_PADDING
  });
  const layoutRef = useRef<HTMLElement | null>(null);
  const floatingPanelRef = useRef<HTMLElement | null>(null);
  const autoPlanSequenceRef = useRef(0);
  const lastAutoPlannedRouteRequestIdRef = useRef<string | null>(null);
  const lastAutoPlanSignatureRef = useRef<string | null>(null);

  const setSlider = (key: keyof RoutePreferences, value: number): void => {
    setRoutePreferenceProfile(CUSTOM_ROUTE_PROFILE_ID);
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const handleRoutePreferenceProfileChange = (value: string): void => {
    const selectedProfile = value as RoutePreferenceProfileId;
    setRoutePreferenceProfile(selectedProfile);

    if (selectedProfile === CUSTOM_ROUTE_PROFILE_ID) {
      return;
    }

    const profile = ROUTE_PREFERENCE_PROFILES.find((item) => item.id === selectedProfile);
    if (profile) {
      setPreferences(profile.preferences);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setError(null);

    if (!routeRequestId) {
      setRouteDetail(null);
      setSelectedRouteId(null);
      setIsLoadingRoute(false);
      return () => {
        isMounted = false;
      };
    }

    setRouteDetail(null);
    setSelectedRouteId(null);
    setIsLoadingRoute(true);
    fetchRoute(routeRequestId)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        const isAutoPlannedRoute = response.routeRequestId === lastAutoPlannedRouteRequestIdRef.current;
        setRouteDetail(response);
        setSelectedRouteId(response.options[0]?.id ?? null);

        if (!isAutoPlannedRoute) {
          const startOption: GeocodeOption = {
            label: response.start.label,
            lat: response.start.lat,
            lng: response.start.lng
          };
          const endOption: GeocodeOption | null = response.end
            ? {
                label: response.end.label,
                lat: response.end.lat,
                lng: response.end.lng
              }
            : null;
          const end = response.end ?? response.start;

          lastAutoPlanSignatureRef.current = computeAutoPlanSignature({
            startLabel: response.start.label,
            endLabel: end.label,
            loopRide: response.loopRide,
            vehicleType: response.vehicleType,
            preferences: response.preferences,
            selectedStartOption: startOption,
            selectedEndOption: endOption
          });
          setStartLabel(response.start.label);
          setSelectedStartOption(startOption);
          setLoopRide(response.loopRide);
          setVehicleType(response.vehicleType);
          setPreferences(response.preferences);
          setRoutePreferenceProfile(resolveRoutePreferenceProfile(response.preferences));

          setEndLabel(end.label);
          setSelectedEndOption(endOption);
        }
      })
      .catch((requestError) => {
        if (!isMounted) {
          return;
        }
        setError(toErrorMessage(requestError));
        setRouteDetail(null);
        setSelectedRouteId(null);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRoute(false);
        }
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
    const layout = layoutRef.current;
    const panel = floatingPanelRef.current;
    if (!layout || !panel) {
      return;
    }

    const updateFitPadding = (): void => {
      const layoutRect = layout.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const overlapWidth = Math.max(
        0,
        Math.min(layoutRect.right, panelRect.right) - Math.max(layoutRect.left, panelRect.left)
      );
      const overlapHeight = Math.max(
        0,
        Math.min(layoutRect.bottom, panelRect.bottom) - Math.max(layoutRect.top, panelRect.top)
      );
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
  }, []);

  useEffect(() => {
    if (isLoadingRoute) {
      return;
    }

    const startAddress = startLabel.trim();
    const destinationAddress = endLabel.trim();
    if (startAddress.length < 3) {
      return;
    }
    if (!loopRide && destinationAddress.length < 3) {
      return;
    }

    const autoPlanSignature = computeAutoPlanSignature({
      startLabel: startAddress,
      endLabel: destinationAddress,
      loopRide,
      vehicleType,
      preferences,
      selectedStartOption,
      selectedEndOption
    });

    if (lastAutoPlanSignatureRef.current === autoPlanSignature) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      const runAutoPlan = async (): Promise<void> => {
        const sequence = autoPlanSequenceRef.current + 1;
        autoPlanSequenceRef.current = sequence;
        setIsSubmitting(true);
        setError(null);

        try {
          const startCoordinates = matchesSelectedOptionLabel(selectedStartOption, startAddress)
            ? selectedStartOption
            : await geocodeAddress(startAddress, 'start address');
          if (!isMounted || autoPlanSequenceRef.current !== sequence) {
            return;
          }

          const payload: PlanRouteRequest = {
            start: {
              label: startAddress,
              lat: startCoordinates.lat,
              lng: startCoordinates.lng
            },
            loopRide,
            vehicleType,
            preferences
          };

          if (!loopRide) {
            const endCoordinates = matchesSelectedOptionLabel(selectedEndOption, destinationAddress)
              ? selectedEndOption
              : await geocodeAddress(destinationAddress, 'end address');
            if (!isMounted || autoPlanSequenceRef.current !== sequence) {
              return;
            }
            payload.end = {
              label: destinationAddress,
              lat: endCoordinates.lat,
              lng: endCoordinates.lng
            };
          }

          const response = await planRoute(payload);
          if (!isMounted || autoPlanSequenceRef.current !== sequence) {
            return;
          }

          lastAutoPlanSignatureRef.current = autoPlanSignature;
          lastAutoPlannedRouteRequestIdRef.current = response.routeRequestId;
          const nextParams = new URLSearchParams(window.location.search);
          nextParams.set('routeRequestId', response.routeRequestId);
          setSearchParams(nextParams, { replace: true });
        } catch (submissionError) {
          if (!isMounted || autoPlanSequenceRef.current !== sequence) {
            return;
          }
          setError(toErrorMessage(submissionError));
        } finally {
          if (isMounted && autoPlanSequenceRef.current === sequence) {
            setIsSubmitting(false);
          }
        }
      };

      void runAutoPlan();
    }, AUTO_PLAN_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    isLoadingRoute,
    loopRide,
    selectedEndOption,
    selectedStartOption,
    setSearchParams,
    startLabel,
    endLabel,
    vehicleType,
    preferences
  ]);

  const handlePlannerSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
  };

  const handleMapCoordinateSelect = (selection: { target: 'start' | 'end'; lat: number; lng: number }): void => {
    const label = coordinateLabel(selection.lat, selection.lng);
    const option: GeocodeOption = {
      label,
      lat: selection.lat,
      lng: selection.lng
    };

    setError(null);
    if (selection.target === 'start') {
      setStartLabel(label);
      setSelectedStartOption(option);
      return;
    }

    setLoopRide(false);
    setEndLabel(label);
    setSelectedEndOption(option);
  };

  return (
    <section className="map-results-layout" ref={layoutRef}>
      <RouteMap
        options={routeDetail?.options ?? []}
        selectedRouteId={selectedRouteId}
        fitPadding={fitPadding}
        onMapCoordinateSelect={handleMapCoordinateSelect}
      />
      <aside className="floating-route-panel" aria-label="Route controls" ref={floatingPanelRef}>
        <section className="planner-float-card">
          <form onSubmit={handlePlannerSubmit} className="planner-grid planner-grid--floating">
            <AddressAutocompleteField
              label="Start address"
              value={startLabel}
              required
              onChange={(value) => {
                setStartLabel(value);
                setSelectedStartOption(null);
              }}
              onSelect={setSelectedStartOption}
            />

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={loopRide}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setLoopRide(checked);
                  if (checked) {
                    setSelectedEndOption(null);
                  }
                }}
              />
              Loop ride (return to start)
            </label>

            <AddressAutocompleteField
              label="End address"
              value={endLabel}
              required={!loopRide}
              disabled={loopRide}
              onChange={(value) => {
                setEndLabel(value);
                setSelectedEndOption(null);
              }}
              onSelect={setSelectedEndOption}
            />

            <section className="planner-results-section" aria-live="polite">
              <h2>Route Results</h2>
              {isLoadingRoute ? (
                <p className="muted">Loading route options...</p>
              ) : (
                <>
                  <label>
                    Route profile
                    <select
                      value={routePreferenceProfile}
                      onChange={(event) => handleRoutePreferenceProfileChange(event.target.value)}
                    >
                      {ROUTE_PREFERENCE_PROFILES.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                      <option value={CUSTOM_ROUTE_PROFILE_ID}>Custom</option>
                    </select>
                  </label>
                  <label>
                    Vehicle
                    <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as VehicleType)}>
                      <option value="motorcycle">Motorcycle</option>
                      <option value="adv_motorcycle">ADV Motorcycle</option>
                      <option value="4x4">4x4</option>
                    </select>
                  </label>
                  {routePreferenceProfile === CUSTOM_ROUTE_PROFILE_ID ? (
                    <div className="preferences-compact-grid">
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
                      <Slider
                        label="Distance influence"
                        value={preferences.distanceInfluence}
                        min={15}
                        max={100}
                        onChange={(value) => setSlider('distanceInfluence', value)}
                      />
                    </div>
                  ) : (
                    <p className="muted profile-preset-hint">
                      Using preset tuning. Select Custom to show manual preference sliders.
                    </p>
                  )}
                  {error && <p className="form-error">{error}</p>}
                  {isSubmitting ? <p className="muted">Auto-generating routes...</p> : null}
                  {selectedRoute && (
                    <p className="from-to-stats">
                      Selected: {formatRouteDistance(selectedRoute.distanceKm)} • {formatRouteDuration(selectedRoute.durationMin)}
                    </p>
                  )}
                  {routeDetail?.options.length ? (
                    <RouteOptionsPanel
                      options={routeDetail.options}
                      selectedRouteId={selectedRouteId}
                      onSelect={setSelectedRouteId}
                    />
                  ) : null}
                </>
              )}
            </section>
          </form>
        </section>
      </aside>
    </section>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, min = 0, max = 100, onChange }: SliderProps) {
  return (
    <label className="preference-slider">
      <span className="preference-slider-meta">
        <span className="preference-slider-label">{label}</span>
        <span className="preference-slider-value">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
