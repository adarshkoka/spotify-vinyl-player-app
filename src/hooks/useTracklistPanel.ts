import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getAlbumTracks,
  getPlaylistTracks,
  getQueue,
  playTrackInContext,
  addToQueue as apiAddToQueue,
  type ContextTrack,
} from '../services/spotifyService';

export type PanelView = 'playlist' | 'album' | 'queue';

interface UseTracklistPanelReturn {
  isOpen: boolean;
  tracks: ContextTrack[];
  selectedTrackUri: string | null;
  panelView: PanelView;
  isSupportedContext: boolean;
  toggleOpen: () => void;
  close: () => void;
  selectTrack: (trackUri: string) => Promise<void>;
  showAlbum: (albumId: string, albumUri: string) => void;
  showPlaylist: () => void;
  showQueue: () => void;
  goBack: () => void;
  addToQueue: (trackUri: string) => Promise<void>;
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
  const [panelView, setPanelView] = useState<PanelView>('playlist');
  const [overrideUri, setOverrideUri] = useState<string | null>(null);
  const [overrideType, setOverrideType] = useState<string | null>(null);
  const prevViewRef = useRef<PanelView>('playlist');

  // Cache tracks per contextUri (not used for queue — always fresh)
  const cacheRef = useRef<Record<string, ContextTrack[]>>({});

  // Whether the current context is fetchable (album or playlist)
  const isSupportedContext = contextType === 'album' || contextType === 'playlist';

  const defaultView: PanelView = isSupportedContext && contextType === 'playlist' ? 'playlist' : 'album';

  const fetchTracksFor = useCallback(async (uri: string, type: string): Promise<ContextTrack[]> => {
    // Use cached if available
    if (cacheRef.current[uri]) {
      const cached = cacheRef.current[uri];
      setTracks(cached);
      return cached;
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

      // If playlist has ≤ 1 tracks, fall back to the album
      if (type === 'playlist' && result.length <= 1) {
        if (fallbackAlbum) {
          const albumUri = fallbackAlbum.uri;
          let albumTracks = cacheRef.current[albumUri];
          if (!albumTracks) {
            const albumId = albumUri.split(':').pop()!;
            albumTracks = await getAlbumTracks(albumId);
            cacheRef.current[albumUri] = albumTracks;
          }
          if (albumTracks.length <= 1) {
            return [];
          }
          setPanelView('album');
          setOverrideUri(albumUri);
          setOverrideType('album');
          setTracks(albumTracks);
          return albumTracks;
        }
        return [];
      }

      cacheRef.current[uri] = result;
      setTracks(result);
      return result;
    } catch (err) {
      console.error('Failed to fetch context tracks:', err);
      setTracks([]);
      return [];
    }
  }, [fallbackAlbum]);

  const fetchQueueTracks = useCallback(async (): Promise<ContextTrack[]> => {
    try {
      const result = await getQueue();
      setTracks(result);
      return result;
    } catch (err) {
      console.error('Failed to fetch queue:', err);
      setTracks([]);
      return [];
    }
  }, []);

  // Clear stale selection when the actual playing track changes (e.g. external skip)
  useEffect(() => {
    setSelectedTrackUri(null);
  }, [currentTrackUri]);

  // When context changes while panel is open, reset overrides and re-fetch
  const prevEffectiveUriRef = useRef<string | null>(null);
  useEffect(() => {
    const effectiveUri = isSupportedContext ? contextUri : fallbackAlbum?.uri ?? null;
    if (prevEffectiveUriRef.current !== null && effectiveUri !== prevEffectiveUriRef.current) {
      // Context changed — reset to default view
      setOverrideUri(null);
      setOverrideType(null);
      if (panelView !== 'queue') {
        setPanelView(defaultView);
      }
      if (isOpen && effectiveUri && panelView !== 'queue') {
        const type = isSupportedContext ? contextType! : 'album';
        fetchTracksFor(effectiveUri, type);
      }
    }
    prevEffectiveUriRef.current = effectiveUri;
  }, [contextUri, fallbackAlbum?.uri, isSupportedContext, contextType, isOpen, fetchTracksFor, panelView, defaultView]);

  const fetchTracks = useCallback(async (): Promise<ContextTrack[]> => {
    const uri = overrideUri ?? (isSupportedContext ? contextUri : fallbackAlbum?.uri ?? null);
    const type = overrideType ?? (isSupportedContext ? contextType : 'album');
    if (!uri || !type) return [];
    return fetchTracksFor(uri, type);
  }, [overrideUri, overrideType, contextUri, contextType, isSupportedContext, fallbackAlbum, fetchTracksFor]);

  // Step 4: fetch-before-open — panel opens only after tracks arrive
  const toggleOpen = useCallback(async () => {
    if (isOpen) {
      setIsOpen(false);
      setPanelView(defaultView);
      setOverrideUri(null);
      setOverrideType(null);
    } else {
      setPanelView(defaultView);
      setOverrideUri(null);
      setOverrideType(null);
      const result = await fetchTracks();
      if (result.length > 0) {
        setIsOpen(true);
      }
    }
  }, [isOpen, fetchTracks, defaultView]);

  const close = useCallback(() => {
    setIsOpen(false);
    setPanelView(defaultView);
    setOverrideUri(null);
    setOverrideType(null);
  }, [defaultView]);

  const showAlbum = useCallback((_albumId: string, albumUri: string) => {
    prevViewRef.current = panelView;
    setPanelView('album');
    setOverrideUri(albumUri);
    setOverrideType('album');
    fetchTracksFor(albumUri, 'album');
  }, [fetchTracksFor, panelView]);

  const showPlaylist = useCallback(() => {
    prevViewRef.current = panelView;
    setPanelView('playlist');
    setOverrideUri(null);
    setOverrideType(null);
    if (contextUri && contextType) {
      fetchTracksFor(contextUri, contextType);
    }
  }, [contextUri, contextType, fetchTracksFor, panelView]);

  const showQueue = useCallback(() => {
    prevViewRef.current = panelView;
    setPanelView('queue');
    fetchQueueTracks();
  }, [panelView, fetchQueueTracks]);

  const goBack = useCallback(() => {
    showPlaylist();
  }, [showPlaylist]);

  const selectTrack = useCallback(async (trackUri: string) => {
    if (panelView === 'queue') {
      // Queue tracks don't have a single context — just highlight
      setSelectedTrackUri(trackUri);
      return;
    }
    const activeContextUri = overrideUri ?? (isSupportedContext ? contextUri : fallbackAlbum?.uri ?? null);
    if (!activeContextUri) return;
    setSelectedTrackUri(trackUri);
    try {
      await playTrackInContext(activeContextUri, trackUri);
    } catch (err) {
      console.error('Failed to play track in context:', err);
    }
  }, [contextUri, overrideUri, isSupportedContext, fallbackAlbum, panelView]);

  const addToQueue = useCallback(async (trackUri: string) => {
    await apiAddToQueue(trackUri);
    // If viewing queue, refresh it to show the newly added track
    if (panelView === 'queue') {
      await fetchQueueTracks();
    }
  }, [panelView, fetchQueueTracks]);

  return {
    isOpen,
    tracks,
    selectedTrackUri,
    panelView,
    isSupportedContext,
    toggleOpen,
    close,
    selectTrack,
    showAlbum,
    showPlaylist,
    showQueue,
    goBack,
    addToQueue,
  };
}
