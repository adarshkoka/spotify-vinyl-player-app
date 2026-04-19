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
  // Add other fields if needed, like context, device, etc.
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
