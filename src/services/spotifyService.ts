// src/services/spotifyService.ts

const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

interface SpotifyApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  accessToken?: string | null;
}

async function spotifyApiCall<T>(
  endpoint: string,
  options: SpotifyApiCallOptions = {}
): Promise<T> {
  const { method = 'GET', body, accessToken } = options;

  const token = accessToken || localStorage.getItem('spotify_access_token');

  if (!token) {
    console.error('Spotify access token not found for API call.');
    // Potentially redirect to login or throw a specific error
    throw new Error('Access token not found. Please login again.');
  }

  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${SPOTIFY_API_BASE_URL}/${endpoint}`, config);

    if (response.status === 204) { // No Content
      return null as T; // Or handle as appropriate for your use case
    }

    const data = await response.json();

    if (!response.ok) {
      console.error('Spotify API Error:', data);
      // More specific error handling based on data.error can be added
      throw new Error(data.error?.message || `Spotify API request failed with status ${response.status}`);
    }
    return data as T;
  } catch (error) {
    console.error('Error during Spotify API call:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
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
}

export interface SpotifyArtist {
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
  const data = await spotifyApiCall<SpotifyPlaylistTracksResponse>(
    `playlists/${encodeURIComponent(playlistId)}/tracks?limit=50&fields=items(track(uri,name,artists(name),track_number,duration_ms))`
  );
  return data.items
    .filter(item => item.track != null)
    .map(item => {
      const t = item.track!;
      return {
        uri: t.uri,
        name: t.name,
        artists: t.artists.map(a => a.name).join(', '),
        track_number: t.track_number,
        duration_ms: t.duration_ms,
      };
    });
}

export async function playTrackInContext(contextUri: string, trackUri: string): Promise<void> {
  await spotifyApiCall<void>('me/player/play', {
    method: 'PUT',
    body: { context_uri: contextUri, offset: { uri: trackUri } },
  });
}
