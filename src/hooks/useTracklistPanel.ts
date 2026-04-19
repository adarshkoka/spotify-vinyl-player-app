import { useState, useCallback, useRef } from 'react';
import {
  getAlbumTracks,
  getPlaylistTracks,
  playTrackInContext,
  type ContextTrack,
} from '../services/spotifyService';

interface UseTracklistPanelReturn {
  isOpen: boolean;
  tracks: ContextTrack[];
  isLoadingTracks: boolean;
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
): UseTracklistPanelReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [tracks, setTracks] = useState<ContextTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
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

    setIsLoadingTracks(true);
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
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  // Whether the current context is fetchable (album or playlist)
  const isSupportedContext = contextType === 'album' || contextType === 'playlist';

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
    isLoadingTracks,
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
