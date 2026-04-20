import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getAlbumTracks,
  getPlaylistTracks,
  playTrackInContext,
  type ContextTrack,
} from '../services/spotifyService';

interface UseTracklistPanelReturn {
  isOpen: boolean;
  tracks: ContextTrack[];
  selectedTrackUri: string | null;
  isShowingAlbum: boolean;
  isSupportedContext: boolean;
  toggleOpen: () => void;
  close: () => void;
  selectTrack: (trackUri: string) => Promise<void>;
  showAlbum: (albumId: string, albumUri: string) => void;
  showContext: () => void;
}

export function useTracklistPanel(
  contextUri: string | null,
  contextType: string | null,
  fallbackAlbum?: { id: string; uri: string } | null,
  currentTrackUri?: string | null,
): UseTracklistPanelReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [tracks, setTracks] = useState<ContextTrack[]>([]);
  const [selectedTrackUri, setSelectedTrackUri] = useState<string | null>(null);
  const [isShowingAlbum, setIsShowingAlbum] = useState(false);
  const [overrideUri, setOverrideUri] = useState<string | null>(null);
  const [overrideType, setOverrideType] = useState<string | null>(null);

  // Cache tracks per contextUri
  const cacheRef = useRef<Record<string, ContextTrack[]>>({});

  const fetchTracksFor = useCallback(async (uri: string, type: string) => {
    // Use cached if available
    if (cacheRef.current[uri]) {
      setTracks(cacheRef.current[uri]);
      return;
    }

    try {
      const parts = uri.split(':');
      const id = parts[parts.length - 1];

      let result: ContextTrack[] = [];
      if (type === 'album') {
        result = await getAlbumTracks(id);
      } else if (type === 'playlist') {
        result = await getPlaylistTracks(id);
      }

      cacheRef.current[uri] = result;
      setTracks(result);
    } catch (err) {
      console.error('Failed to fetch context tracks:', err);
      setTracks([]);
    }
  }, []);

  // Whether the current context is fetchable (album or playlist)
  const isSupportedContext = contextType === 'album' || contextType === 'playlist';

  // Clear stale selection when the actual playing track changes (e.g. external skip)
  useEffect(() => {
    setSelectedTrackUri(null);
  }, [currentTrackUri]);

  // When context changes while panel is open, reset overrides and re-fetch
  const prevEffectiveUriRef = useRef<string | null>(null);
  useEffect(() => {
    const effectiveUri = isSupportedContext ? contextUri : fallbackAlbum?.uri ?? null;
    if (prevEffectiveUriRef.current !== null && effectiveUri !== prevEffectiveUriRef.current) {
      // Context changed — reset album/playlist override
      setIsShowingAlbum(false);
      setOverrideUri(null);
      setOverrideType(null);
      if (isOpen && effectiveUri) {
        const type = isSupportedContext ? contextType! : 'album';
        fetchTracksFor(effectiveUri, type);
      }
    }
    prevEffectiveUriRef.current = effectiveUri;
  }, [contextUri, fallbackAlbum?.uri, isSupportedContext, contextType, isOpen, fetchTracksFor]);

  const fetchTracks = useCallback(async () => {
    const uri = overrideUri ?? (isSupportedContext ? contextUri : fallbackAlbum?.uri ?? null);
    const type = overrideType ?? (isSupportedContext ? contextType : 'album');
    if (!uri || !type) return;
    await fetchTracksFor(uri, type);
  }, [overrideUri, overrideType, contextUri, contextType, isSupportedContext, fallbackAlbum, fetchTracksFor]);

  const toggleOpen = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      setIsShowingAlbum(false);
      setOverrideUri(null);
      setOverrideType(null);
    } else {
      setIsShowingAlbum(false);
      setOverrideUri(null);
      setOverrideType(null);
      setIsOpen(true);
      fetchTracks();
    }
  }, [isOpen, fetchTracks]);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsShowingAlbum(false);
    setOverrideUri(null);
    setOverrideType(null);
  }, []);

  const showAlbum = useCallback((_albumId: string, albumUri: string) => {
    setIsShowingAlbum(true);
    setOverrideUri(albumUri);
    setOverrideType('album');
    fetchTracksFor(albumUri, 'album');
  }, [fetchTracksFor]);

  const showContext = useCallback(() => {
    setIsShowingAlbum(false);
    setOverrideUri(null);
    setOverrideType(null);
    if (contextUri && contextType) {
      fetchTracksFor(contextUri, contextType);
    }
  }, [contextUri, contextType, fetchTracksFor]);

  const selectTrack = useCallback(async (trackUri: string) => {
    const activeContextUri = overrideUri ?? (isSupportedContext ? contextUri : fallbackAlbum?.uri ?? null);
    if (!activeContextUri) return;
    // Highlight immediately
    setSelectedTrackUri(trackUri);
    // Fire play request
    try {
      await playTrackInContext(activeContextUri, trackUri);
    } catch (err) {
      console.error('Failed to play track in context:', err);
    }
  }, [contextUri, overrideUri, isSupportedContext, fallbackAlbum]);

  return {
    isOpen,
    tracks,
    selectedTrackUri,
    isShowingAlbum,
    isSupportedContext,
    toggleOpen,
    close,
    selectTrack,
    showAlbum,
    showContext,
  };
}
