// Reject points outside the map's Indonesia coverage. A point that passes
// this check is still an attribution to the publisher, not verification.
export function newsPoint(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -11.7 || lat > 6.3 || lng < 94.4 || lng > 141.5) return null;
  return [lat, lng];
}

export function publisherPoint(value) {
  const match = String(value ?? '').trim().match(/^([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)$/);
  return match ? newsPoint(Number(match[1]), Number(match[2])) : null;
}
