// Hook for service area validation
import { useState, useEffect } from 'react';
import { checkServiceArea, validateLocationByZip, type ServiceAreaStatus } from '@/src/lib/service-area';

const DEFAULT_STATUS: ServiceAreaStatus = {
  allowed: false,
  hubId: null,
  hubName: null,
  hubSlug: null,
  distanceMiles: null,
  activeRadiusMiles: null,
  ring: null,
  boundaryStatus: 'outside',
  inviteOnly: true,
  message: '',
};

export function useServiceArea(zip: string | null): ServiceAreaStatus & { loading: boolean } {
  const [status, setStatus] = useState<ServiceAreaStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!zip || zip.length < 5) {
      setStatus(DEFAULT_STATUS);
      return;
    }

    let cancelled = false;
    setLoading(true);

    validateLocationByZip(zip).then((result) => {
      if (!cancelled) {
        setStatus(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [zip]);

  return { ...status, loading };
}

export function useServiceAreaByCoords(
  lat: number | null,
  lng: number | null
): ServiceAreaStatus & { loading: boolean } {
  const [status, setStatus] = useState<ServiceAreaStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat === null || lng === null) {
      setStatus(DEFAULT_STATUS);
      return;
    }

    let cancelled = false;
    setLoading(true);

    checkServiceArea(lat, lng).then((result) => {
      if (!cancelled) {
        setStatus(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return { ...status, loading };
}
