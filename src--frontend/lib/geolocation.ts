import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  address?: string;
}

export interface GeoFence {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radius: number;
  type: 'office' | 'field' | 'client';
}

export interface TrackingState {
  isTracking: boolean;
  currentLocation: Location | null;
  lastUpdate: number | null;
  error: string | null;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unavailable';
}

const DEFAULT_CAMPUS_CENTER = {
  lat: parseFloat(import.meta.env.VITE_CAMPUS_LATITUDE || '17.5'),
  lng: parseFloat(import.meta.env.VITE_CAMPUS_LONGITUDE || '78.5'),
};
const DEFAULT_MAX_DISTANCE = parseInt(import.meta.env.VITE_MAX_ATTENDANCE_DISTANCE || '500');

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function isWithinGeoFence(
  location: Location,
  fence: GeoFence
): { within: boolean; distance: number } {
  const distance = calculateDistance(
    location.latitude,
    location.longitude,
    fence.center.lat,
    fence.center.lng
  );
  return {
    within: distance <= fence.radius,
    distance: Math.round(distance),
  };
}

export function isWithinCampus(location: Location): { within: boolean; distance: number } {
  return isWithinGeoFence(location, {
    id: 'campus',
    name: 'Campus',
    center: DEFAULT_CAMPUS_CENTER,
    radius: DEFAULT_MAX_DISTANCE,
    type: 'office',
  });
}

export function useGeoLocation(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}) {
  const [state, setState] = useState<TrackingState>({
    isTracking: false,
    currentLocation: null,
    lastUpdate: null,
    error: null,
    permissionStatus: 'prompt',
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  const checkPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, permissionStatus: 'unavailable', error: 'Geolocation not supported' }));
      return false;
    }

    const permission = await navigator.permissions.query({ name: 'geolocation' });
    setState(prev => ({ 
      ...prev, 
      permissionStatus: permission.state as TrackingState['permissionStatus'] 
    }));
    return permission.state === 'granted';
  }, []);

  const getCurrentPosition = useCallback((): Promise<Location> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          resolve(location);
        },
        (error) => reject(error),
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 0,
        }
      );
    });
  }, [options]);

  const startTracking = useCallback(async () => {
    const hasPermission = await checkPermission();
    if (!hasPermission) {
      setState(prev => ({ 
        ...prev, 
        error: 'Geolocation permission denied',
        isTracking: false 
      }));
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const location: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setState(prev => ({
          ...prev,
          currentLocation: location,
          lastUpdate: Date.now(),
          error: null,
          isTracking: true,
        }));
      },
      (error) => {
        setState(prev => ({
          ...prev,
          error: error.message,
          isTracking: false,
        }));
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 10000,
        maximumAge: options?.maximumAge ?? 5000,
      }
    );

    setWatchId(id);
    setState(prev => ({ ...prev, isTracking: true }));
  }, [checkPermission, options]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setState(prev => ({ ...prev, isTracking: false }));
  }, [watchId]);

  const recordAttendanceLocation = useCallback(async (
    userId: string,
    organizationId: string,
    type: 'check_in' | 'check_out'
  ) => {
    if (!state.currentLocation) {
      throw new Error('No location available');
    }

    const withinCampus = isWithinCampus(state.currentLocation);
    const campusStatus = withinCampus.within ? 'inside' : 'outside';

    // Bind the row to the authenticated session, never to a caller-supplied
    // id. RLS cannot help here: this write went straight to the table with the
    // anon key, so a student could stamp attendance for any user_id they liked.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    if (user.id !== userId) throw new Error('Cannot record attendance for another user');

    const { data, error } = await supabase.from('attendance').insert({
      user_id: user.id,
      organization_id: organizationId,
      type,
      location: {
        latitude: state.currentLocation.latitude,
        longitude: state.currentLocation.longitude,
        accuracy: state.currentLocation.accuracy,
      },
      campus_status: campusStatus,
      distance_from_campus: withinCampus.distance,
      recorded_at: new Date().toISOString(),
    });

    if (error) throw error;
    return data;
  }, [state.currentLocation]);

  const recordFieldLocation = useCallback(async (
    userId: string,
    organizationId: string,
    clientId?: string
  ) => {
    if (!state.currentLocation) {
      throw new Error('No location available');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    if (user.id !== userId) throw new Error('Cannot record tracking for another user');

    const { data, error } = await supabase.from('field_tracking').insert({
      user_id: user.id,
      organization_id: organizationId,
      client_id: clientId,
      location: {
        latitude: state.currentLocation.latitude,
        longitude: state.currentLocation.longitude,
        accuracy: state.currentLocation.accuracy,
      },
      recorded_at: new Date().toISOString(),
    });

    if (error) throw error;
    return data;
  }, [state.currentLocation]);

  useEffect(() => {
    checkPermission();
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [checkPermission, watchId]);

  return {
    ...state,
    getCurrentPosition,
    startTracking,
    stopTracking,
    recordAttendanceLocation,
    recordFieldLocation,
    isWithinCampus: state.currentLocation ? isWithinCampus(state.currentLocation) : null,
    checkPermission,
  };
}

export function useFieldEmployeeTracking(userId: string, organizationId: string) {
  const geo = useGeoLocation();
  const [route, setRoute] = useState<Location[]>([]);
  const [checkpoints, setCheckpoints] = useState<{id: string; visited: boolean}[]>([]);

  const recordCheckpoint = useCallback(async (checkpointId: string) => {
    if (!geo.currentLocation) return;

    await geo.recordFieldLocation(userId, organizationId);
    
    setRoute(prev => [...prev, geo.currentLocation!]);
    setCheckpoints(prev => 
      prev.map(cp => cp.id === checkpointId ? { ...cp, visited: true } : cp)
    );
  }, [geo, userId, organizationId]);

  return {
    ...geo,
    route,
    checkpoints,
    recordCheckpoint,
    totalDistance: route.length > 1 
      ? calculateDistance(
          route[0].latitude,
          route[0].longitude,
          route[route.length - 1].latitude,
          route[route.length - 1].longitude
        )
      : 0,
  };
}
