export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function boundingBox(
  center: LatLng,
  radiusMeters: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lngDelta =
    (radiusMeters / (EARTH_RADIUS_METERS * Math.cos(toRadians(center.lat)))) *
    (180 / Math.PI);
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}
