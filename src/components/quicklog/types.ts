// Shared types for the Quick Log form and its hooks.

export type MessageType = 'success' | 'error' | 'info' | 'warning' | '';

export interface MessageState {
  type: MessageType;
  text: string;
}

export type SetMessage = (message: MessageState) => void;

/**
 * Location stored with a log. `locationAccuracy` is only present for
 * GPS-derived fixes; a manually pinned location has no accuracy figure.
 */
export interface LocationData {
  latitude: number;
  longitude: number;
  locationAccuracy?: number;
}

export type LocationMode = 'gps' | 'manual';
