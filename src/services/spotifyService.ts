// src/services/spotifyService.ts

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

interface SpotifyApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  accessToken?: string | null;
}

let isRefreshing: Promise<string | null> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token, or null if refresh fails.
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

  if (!refreshToken || !clientId) return null;

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (response.ok && data.access_token) {
      localStorage.setItem('spotify_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
      }
      if (data.expires_in) {
        const expiresAt = Date.now() + data.expires_in * 1000;
        localStorage.setItem('spotify_token_expires_at', String(expiresAt));
      }
      return data.access_token;
    }
  } catch (err) {
    console.error('Failed to refresh access token:', err);
  }

  // Refresh failed — clear auth so the user is prompted to log in again
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expires_at');
  window.dispatchEvent(new Event('authChange'));
  return null;
}

/**
 * Ensure we have a valid (non-expired) access token, refreshing proactively
 * if it's about to expire within the next 60 seconds.
 */
async function ensureValidToken(): Promise<string | null> {
  const expiresAt = Number(localStorage.getItem('spotify_token_expires_at') || '0');
  const token = localStorage.getItem('spotify_access_token');

  // If token exists and is not expiring within 60s, use it
  if (token && expiresAt > Date.now() + 60_000) {
    return token;
  }

  // Token is expired or about to expire — refresh
  // Deduplicate concurrent refresh calls
  if (!isRefreshing) {
    isRefreshing = refreshAccessToken().finally(() => { isRefreshing = null; });
  }
  return isRefreshing;
}

async function spotifyApiCall<T>(
  endpoint: string,
  options: SpotifyApiCallOptions = {}
): Promise<T> {
  const { method = 'GET', body, accessToken } = options;

  const token = accessToken || await ensureValidToken() || localStorage.getItem('spotify_access_token');

  if (!token) {
    throw new Error('Access token not found. Please login again.');
  }

  const doFetch = async (tkn: string) => {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${tkn}`,
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }

    return fetch(`${SPOTIFY_API_BASE_URL}/${endpoint}`, config);
  };

  let response = await doFetch(token);

  // On 401, attempt one token refresh and retry
  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = refreshAccessToken().finally(() => { isRefreshing = null; });
    }
    const newToken = await isRefreshing;
    if (newToken) {
      response = await doFetch(newToken);
    } else {
      throw new Error('Access token expired and refresh failed. Please login again.');
    }
  }

  if (response.status === 204) {
    return null as T;
  }

  const data = await response.json();

  if (!response.ok) {
    console.error('Spotify API Error:', data);
    throw new Error(data.error?.message || `Spotify API request failed with status ${response.status}`);
  }
  return data as T;
}

export default spotifyApiCall;

// --- New code below ---

export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyAlbum {
  id: string;
  uri: string;
  name: string;
  images: SpotifyImage[];
  total_tracks?: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
  duration_ms: number;
}

export interface CurrentlyPlayingResponse {
  item: SpotifyTrack | null;
  is_playing: boolean;
  progress_ms: number | null;
  timestamp: number;
  context?: {
    type: string;
    uri: string;
    href: string;
  } | null;
}

export async function getCurrentlyPlayingSong(): Promise<CurrentlyPlayingResponse | null> {
  try {
    const response = await spotifyApiCall<CurrentlyPlayingResponse>('me/player/currently-playing');
    return response;
  } catch (error) {
    console.error('Error fetching currently playing song:', error);
    // Depending on how you want to handle errors, you might return null,
    // or rethrow a more specific error, or handle it in the component.
    // For now, returning null if there's an error or if no song is playing (204 handled by spotifyApiCall)
    return null;
  }
}

export async function pausePlayback(): Promise<void> {
  await spotifyApiCall<void>('me/player/pause', { method: 'PUT' });
}

export async function resumePlayback(): Promise<void> {
  await spotifyApiCall<void>('me/player/play', { method: 'PUT' });
}

export async function skipToNext(): Promise<void> {
  await spotifyApiCall<void>('me/player/next', { method: 'POST' });
}

export async function skipToPrevious(): Promise<void> {
  await spotifyApiCall<void>('me/player/previous', { method: 'POST' });
}

// --- Context track types ---

export interface ContextTrack {
  uri: string;
  name: string;
  artists: string;
  track_number: number;
  duration_ms: number;
}

interface SpotifyAlbumTracksResponse {
  items: Array<{
    uri: string;
    name: string;
    artists: SpotifyArtist[];
    track_number: number;
    duration_ms: number;
  }>;
}

interface SpotifyPlaylistTracksResponse {
  items: Array<{
    track: {
      uri: string;
      name: string;
      artists: SpotifyArtist[];
      track_number: number;
      duration_ms: number;
    } | null;
  }>;
  next: string | null;
}

export async function getAlbumTracks(albumId: string): Promise<ContextTrack[]> {
  const data = await spotifyApiCall<SpotifyAlbumTracksResponse>(
    `albums/${encodeURIComponent(albumId)}/tracks?limit=50`
  );
  return data.items.map(t => ({
    uri: t.uri,
    name: t.name,
    artists: t.artists.map(a => a.name).join(', '),
    track_number: t.track_number,
    duration_ms: t.duration_ms,
  }));
}

export async function getPlaylistTracks(playlistId: string): Promise<ContextTrack[]> {
  // Spotify caps each page at 100 items, so page through `next` until exhausted
  // to load the full playlist (unlike Liked Songs, the panel shows all at once).
  const tracks: ContextTrack[] = [];
  let offset = 0;
  for (;;) {
    const data = await spotifyApiCall<SpotifyPlaylistTracksResponse>(
      `playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&offset=${offset}&fields=next,items(track(uri,name,artists(name),track_number,duration_ms))`
    );
    for (const item of data.items) {
      if (item.track == null) continue;
      const t = item.track;
      tracks.push({
        uri: t.uri,
        name: t.name,
        artists: t.artists.map(a => a.name).join(', '),
        track_number: t.track_number,
        duration_ms: t.duration_ms,
      });
    }
    if (data.next == null) break;
    offset += data.items.length;
  }
  return tracks;
}

export async function playTrackInContext(contextUri: string, trackUri: string, deviceId?: string): Promise<void> {
  const path = deviceId
    ? `me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : 'me/player/play';
  await spotifyApiCall<void>(path, {
    method: 'PUT',
    body: { context_uri: contextUri, offset: { uri: trackUri } },
  });
}

export async function playTrackByUri(trackUri: string, deviceId?: string): Promise<void> {
  const path = deviceId
    ? `me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : 'me/player/play';
  await spotifyApiCall<void>(path, {
    method: 'PUT',
    body: { uris: [trackUri] },
  });
}

/** Play a list of track URIs, optionally starting at a specific URI. Spotify caps `uris` at 100. */
export async function playUriList(uris: string[], offsetUri: string | undefined, deviceId?: string): Promise<void> {
  const path = deviceId
    ? `me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : 'me/player/play';
  const body: Record<string, unknown> = { uris: uris.slice(0, 100) };
  if (offsetUri) body.offset = { uri: offsetUri };
  await spotifyApiCall<void>(path, { method: 'PUT', body });
}

/** Toggle Spotify's shuffle state. */
export async function setShuffleState(state: boolean, deviceId?: string): Promise<void> {
  const params = new URLSearchParams({ state: String(state) });
  if (deviceId) params.set('device_id', deviceId);
  await spotifyApiCall<void>(`me/player/shuffle?${params.toString()}`, { method: 'PUT' });
}

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
}

interface SpotifyDevicesResponse {
  devices: SpotifyDevice[];
}

/** List the user's available Spotify Connect devices. */
export async function getAvailableDevices(): Promise<SpotifyDevice[]> {
  const data = await spotifyApiCall<SpotifyDevicesResponse>('me/player/devices');
  return (data.devices ?? []).filter(d => !d.is_restricted && !!d.id);
}

interface SpotifyPlaybackStateResponse {
  device?: SpotifyDevice | null;
}

/**
 * Return the device of the user's most-recently-used Spotify session (active
 * OR paused). Falls back to the first available device when there's no
 * current session at all. Used by the Liked Songs panel to pick a sensible
 * target device when nothing is currently playing.
 */
export async function getRecentDevice(): Promise<SpotifyDevice | null> {
  try {
    const data = await spotifyApiCall<SpotifyPlaybackStateResponse | null>('me/player');
    if (data?.device && !data.device.is_restricted && data.device.id) {
      return data.device;
    }
  } catch (err) {
    console.warn('me/player lookup failed:', err);
  }
  const devices = await getAvailableDevices();
  return devices[0] ?? null;
}

// --- Queue ---

interface SpotifyQueueResponse {
  currently_playing: {
    uri: string;
    name: string;
    artists: SpotifyArtist[];
    duration_ms: number;
  } | null;
  queue: Array<{
    uri: string;
    name: string;
    artists: SpotifyArtist[];
    duration_ms: number;
  }>;
}

export async function getQueue(): Promise<ContextTrack[]> {
  const data = await spotifyApiCall<SpotifyQueueResponse>('me/player/queue');
  const result: ContextTrack[] = [];
  let pos = 1;
  if (data.currently_playing) {
    const c = data.currently_playing;
    result.push({
      uri: c.uri,
      name: c.name,
      artists: c.artists.map(a => a.name).join(', '),
      track_number: pos++,
      duration_ms: c.duration_ms,
    });
  }
  for (const t of data.queue) {
    result.push({
      uri: t.uri,
      name: t.name,
      artists: t.artists.map(a => a.name).join(', '),
      track_number: pos++,
      duration_ms: t.duration_ms,
    });
  }
  return result;
}

export async function addToQueue(trackUri: string): Promise<void> {
  await spotifyApiCall<void>(
    `me/player/queue?uri=${encodeURIComponent(trackUri)}`,
    { method: 'POST' }
  );
}

export async function seekToPosition(positionMs: number): Promise<void> {
  await spotifyApiCall<void>(
    `me/player/seek?position_ms=${Math.round(Math.max(0, positionMs))}`,
    { method: 'PUT' }
  );
}

// --- Library (Liked Songs) ---

interface SpotifyLikedSongsResponse {
  items: Array<{
    track: {
      uri: string;
      name: string;
      artists: SpotifyArtist[];
      duration_ms: number;
    } | null;
  }>;
  next: string | null;
  total: number;
}

export interface LikedSongsPage {
  tracks: ContextTrack[];
  hasMore: boolean;
}

export async function getLikedSongs(limit = 50, offset = 0): Promise<LikedSongsPage> {
  const data = await spotifyApiCall<SpotifyLikedSongsResponse>(
    `me/tracks?limit=${limit}&offset=${offset}`
  );
  const tracks: ContextTrack[] = data.items
    .filter(item => item.track != null)
    .map((item, i) => {
      const t = item.track!;
      return {
        uri: t.uri,
        name: t.name,
        artists: t.artists.map(a => a.name).join(', '),
        track_number: offset + i + 1,
        duration_ms: t.duration_ms,
      };
    });
  return { tracks, hasMore: data.next != null };
}

export async function checkSavedTracks(trackIds: string[]): Promise<boolean[]> {
  if (trackIds.length === 0) return [];
  const ids = trackIds.slice(0, 50).join(',');
  return spotifyApiCall<boolean[]>(`me/tracks/contains?ids=${encodeURIComponent(ids)}`);
}

export async function saveTracksToLibrary(trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return;
  await spotifyApiCall<void>('me/tracks', {
    method: 'PUT',
    body: { ids: trackIds.slice(0, 50) },
  });
}

export interface UserPlaylist {
  id: string;
  uri: string;
  name: string;
  imageUrl: string | null;
}

interface SpotifyMeResponse {
  id: string;
}

interface SpotifyUserPlaylistsResponse {
  items: Array<{
    id: string;
    uri: string;
    name: string;
    images: Array<{ url: string }> | null;
    owner: { id: string };
  }>;
  next: string | null;
}

let cachedUserId: string | null = null;

async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const data = await spotifyApiCall<SpotifyMeResponse>('me');
  cachedUserId = data.id;
  return data.id;
}

/**
 * Fetch playlists owned by the current user. Spotify's `me/playlists` returns
 * both owned and followed playlists; we filter by owner id. Paginates up to a
 * hard cap so users following hundreds of playlists don't trigger a long burst
 * of API calls.
 */
export async function getUserPlaylists(): Promise<UserPlaylist[]> {
  const userId = await getCurrentUserId();
  const result: UserPlaylist[] = [];
  let path: string | null = 'me/playlists?limit=50';
  let pagesFetched = 0;
  const MAX_PAGES = 4;
  while (path && pagesFetched < MAX_PAGES) {
    const data: SpotifyUserPlaylistsResponse = await spotifyApiCall<SpotifyUserPlaylistsResponse>(path);
    for (const p of data.items) {
      if (p.owner.id === userId) {
        result.push({
          id: p.id,
          uri: p.uri,
          name: p.name,
          imageUrl: p.images?.[0]?.url ?? null,
        });
      }
    }
    pagesFetched++;
    path = data.next ? data.next.replace(`${SPOTIFY_API_BASE_URL}/`, '') : null;
  }
  return result;
}
