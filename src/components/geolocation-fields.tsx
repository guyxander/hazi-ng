"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";

type GeolocationFieldsProps = {
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
  defaultAddress?: string | null;
  addressName?: string;
  required?: boolean;
};

const ADDRESS_SUGGESTIONS = [
  { label: "Abule Egba, Lagos", latitude: 6.6402, longitude: 3.3091 },
  { label: "Agege, Lagos", latitude: 6.6219, longitude: 3.3258 },
  { label: "Ajah, Lagos", latitude: 6.4698, longitude: 3.5852 },
  { label: "Alaba, Lagos", latitude: 6.4629, longitude: 3.1838 },
  { label: "Alimosho, Lagos", latitude: 6.5843, longitude: 3.2577 },
  { label: "Anthony Village, Lagos", latitude: 6.5546, longitude: 3.3766 },
  { label: "Apapa, Lagos", latitude: 6.4452, longitude: 3.3684 },
  { label: "Badagry, Lagos", latitude: 6.4150, longitude: 2.8813 },
  { label: "Berger, Lagos", latitude: 6.6344, longitude: 3.3650 },
  { label: "CMS, Lagos", latitude: 6.4549, longitude: 3.3958 },
  { label: "Dopemu, Lagos", latitude: 6.6129, longitude: 3.3029 },
  { label: "Egbeda, Lagos", latitude: 6.5987, longitude: 3.2916 },
  { label: "Ejigbo, Lagos", latitude: 6.5516, longitude: 3.3070 },
  { label: "Festac, Lagos", latitude: 6.4698, longitude: 3.2824 },
  { label: "Gbagada, Lagos", latitude: 6.5567, longitude: 3.3915 },
  { label: "Iba, Lagos", latitude: 6.4688, longitude: 3.2055 },
  { label: "Idimu, Lagos", latitude: 6.5751, longitude: 3.2739 },
  { label: "Ifako-Ijaiye, Lagos", latitude: 6.6674, longitude: 3.3218 },
  { label: "Igando, Lagos", latitude: 6.5414, longitude: 3.2582 },
  { label: "Ijora, Lagos", latitude: 6.4691, longitude: 3.3734 },
  { label: "Ikeja, Lagos", latitude: 6.6018, longitude: 3.3515 },
  { label: "Ikorodu, Lagos", latitude: 6.6194, longitude: 3.5105 },
  { label: "Ikotun, Lagos", latitude: 6.5407, longitude: 3.2488 },
  { label: "Ikoyi, Lagos", latitude: 6.4541, longitude: 3.4320 },
  { label: "Ilupeju, Lagos", latitude: 6.5536, longitude: 3.3678 },
  { label: "Ipaja, Lagos", latitude: 6.6123, longitude: 3.2781 },
  { label: "Isolo, Lagos", latitude: 6.5359, longitude: 3.3087 },
  { label: "Ketu, Lagos", latitude: 6.5965, longitude: 3.3868 },
  { label: "Lekki Phase 1, Lagos", latitude: 6.4474, longitude: 3.4723 },
  { label: "Magodo, Lagos", latitude: 6.6216, longitude: 3.3746 },
  { label: "Maryland, Lagos", latitude: 6.5726, longitude: 3.3675 },
  { label: "Mile 2, Lagos", latitude: 6.4593, longitude: 3.3151 },
  { label: "Mushin, Lagos", latitude: 6.5273, longitude: 3.3475 },
  { label: "Obalende, Lagos", latitude: 6.4459, longitude: 3.4085 },
  { label: "Ogba, Lagos", latitude: 6.6260, longitude: 3.3375 },
  { label: "Ogudu, Lagos", latitude: 6.5811, longitude: 3.3906 },
  { label: "Ojodu, Lagos", latitude: 6.6385, longitude: 3.3553 },
  { label: "Ojota, Lagos", latitude: 6.5780, longitude: 3.3860 },
  { label: "Okota, Lagos", latitude: 6.5105, longitude: 3.3146 },
  { label: "Opebi, Lagos", latitude: 6.5925, longitude: 3.3608 },
  { label: "Oshodi, Lagos", latitude: 6.5550, longitude: 3.3436 },
  { label: "Sangotedo, Lagos", latitude: 6.4718, longitude: 3.6354 },
  { label: "Surulere, Lagos", latitude: 6.5006, longitude: 3.3509 },
  { label: "Victoria Island, Lagos", latitude: 6.4281, longitude: 3.4219 },
  { label: "Yaba, Lagos", latitude: 6.5165, longitude: 3.3792 }
];

function isWithinNigeria(latitude: number, longitude: number) {
  return latitude >= 4 && latitude <= 14.5 && longitude >= 2.5 && longitude <= 15.5;
}

function getDistanceKm(first: { latitude: number; longitude: number }, second: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getNearestAddress(latitude: number, longitude: number) {
  return ADDRESS_SUGGESTIONS
    .map((item) => ({
      ...item,
      distanceKm: getDistanceKm({ latitude, longitude }, item)
    }))
    .sort((first, second) => first.distanceKm - second.distanceKm)[0]?.label ?? "Lagos, Nigeria";
}

export function GeolocationFields({
  defaultLatitude,
  defaultLongitude,
  defaultAddress,
  addressName,
  required = false
}: GeolocationFieldsProps) {
  const [latitude, setLatitude] = useState(defaultLatitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(defaultLongitude?.toString() ?? "");
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [status, setStatus] = useState(latitude && longitude
    ? "Location coordinates saved."
    : required
      ? "Required before you can publish this item."
      : "Add coordinates for automatic delivery estimates.");
  const [isLocating, setIsLocating] = useState(false);
  const [showManualFields, setShowManualFields] = useState(false);

  function applyAddressSuggestion(value: string) {
    setAddress(value);

    const suggestion = ADDRESS_SUGGESTIONS.find((item) => item.label.toLowerCase() === value.trim().toLowerCase());

    if (!suggestion) {
      if (!latitude || !longitude) {
        setLatitude("");
        setLongitude("");
        setStatus("Choose one of the suggested addresses so Hazi.ng can save the pickup point.");
      } else {
        setStatus("Address updated. Current location coordinates are still saved.");
      }
      return;
    }

    setLatitude(suggestion.latitude.toFixed(6));
    setLongitude(suggestion.longitude.toFixed(6));
    setStatus("Address selected. Save or publish to use it for delivery estimates.");
  }

  function getLocationErrorMessage(error: GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) {
      return "Chrome blocked location access for this page. Check site permissions and try again.";
    }

    if (error.code === error.POSITION_UNAVAILABLE) {
      return "Chrome has permission, but Android could not get your position. Turn on phone Location, enable precise location for Chrome, then try again.";
    }

    if (error.code === error.TIMEOUT) {
      return "Chrome took too long to get your location. Move near a window, turn on phone Location, or enter coordinates manually.";
    }

    return error.message || "Chrome could not get your location. You can enter coordinates manually.";
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported on this device.");
      setShowManualFields(true);
      return;
    }

    setIsLocating(true);
    setStatus("Getting your current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = Number(position.coords.latitude.toFixed(6));
        const nextLongitude = Number(position.coords.longitude.toFixed(6));

        if (!isWithinNigeria(nextLatitude, nextLongitude)) {
          setLatitude("");
          setLongitude("");
          setStatus("Chrome returned a location outside Nigeria. Choose your pickup address from the suggestions.");
          setIsLocating(false);
          setShowManualFields(true);
          return;
        }

        setLatitude(nextLatitude.toFixed(6));
        setLongitude(nextLongitude.toFixed(6));
        if (addressName) {
          setAddress(getNearestAddress(nextLatitude, nextLongitude));
        }
        setStatus("Location captured and matched to the nearest town/state label.");
        setIsLocating(false);
        setShowManualFields(false);
      },
      (error) => {
        setStatus(getLocationErrorMessage(error));
        setIsLocating(false);
        setShowManualFields(true);
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 300000
      }
    );
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />
      {addressName ? <input type="hidden" name={addressName} value={address} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[var(--primary)]">
            Delivery coordinates {required ? <span className="text-red-700">*</span> : null}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{status}</p>
        </div>
        <button className="button button-outline" type="button" onClick={useCurrentLocation} disabled={isLocating}>
          <LocateFixed size={16} /> {isLocating ? "Locating..." : "Use my current location"}
        </button>
        <button className="button button-outline" type="button" onClick={() => setShowManualFields(true)}>
          Choose address
        </button>
      </div>
      {showManualFields || addressName ? (
        <>
          <div className="mt-4">
            <label className="text-xs font-extrabold text-[var(--muted)]">Pickup address</label>
            <input
              className="input mt-1"
              list="hazi-address-suggestions"
              value={address}
              onChange={(event) => applyAddressSuggestion(event.target.value)}
              placeholder="Start typing, e.g. Ojota, Lagos"
            />
            <datalist id="hazi-address-suggestions">
              {ADDRESS_SUGGESTIONS.map((item) => (
                <option key={item.label} value={item.label} />
              ))}
            </datalist>
          </div>
          <p className="mt-2 text-xs font-bold text-[var(--muted)]">Select a suggested address so Hazi.ng can save the pickup point for delivery estimates.</p>
        </>
      ) : null}
      {latitude && longitude ? (
        <p className="mt-3 text-xs font-bold text-[var(--muted)]">
          {latitude}, {longitude}
        </p>
      ) : null}
    </div>
  );
}
