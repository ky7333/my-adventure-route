export function formatRouteDuration(durationMinutes: number): string {
  const roundedMinutes = Math.max(0, Math.round(durationMinutes));

  if (roundedMinutes <= 60) {
    return `${roundedMinutes} min`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return `${hours}h ${minutes}m`;
}
