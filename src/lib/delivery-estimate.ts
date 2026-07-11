export type Coordinates = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

export type DeliveryEstimate = {
  distanceKm: number;
  estimatedFee: number;
};

const NIGERIA_BOUNDS = {
  minLatitude: 4,
  maxLatitude: 14.5,
  minLongitude: 2.5,
  maxLongitude: 15.5
};

const MAX_SUPPORTED_DELIVERY_DISTANCE_KM = 1500;

function toRadians(value: number) {
  return value * Math.PI / 180;
}

export function isWithinNigeria(latitude: number, longitude: number) {
  return latitude >= NIGERIA_BOUNDS.minLatitude
    && latitude <= NIGERIA_BOUNDS.maxLatitude
    && longitude >= NIGERIA_BOUNDS.minLongitude
    && longitude <= NIGERIA_BOUNDS.maxLongitude;
}

export function hasCoordinates(value: Coordinates | null | undefined): value is { latitude: number; longitude: number } {
  return typeof value?.latitude === "number"
    && Number.isFinite(value.latitude)
    && typeof value.longitude === "number"
    && Number.isFinite(value.longitude)
    && isWithinNigeria(value.latitude, value.longitude);
}

export function getDistanceKm(origin: Coordinates, destination: Coordinates) {
  if (!hasCoordinates(origin) || !hasCoordinates(destination)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function getDeliveryEstimate(origin: Coordinates, destination: Coordinates): DeliveryEstimate | null {
  const distanceKm = getDistanceKm(origin, destination);

  if (distanceKm === null || distanceKm > MAX_SUPPORTED_DELIVERY_DISTANCE_KM) {
    return null;
  }

  const roundedDistance = Math.max(1, Math.round(distanceKm * 10) / 10);
  const baseFee = 2000;
  const perKmFee = 450;
  const estimatedFee = Math.ceil((baseFee + roundedDistance * perKmFee) / 100) * 100;

  return {
    distanceKm: roundedDistance,
    estimatedFee
  };
}
