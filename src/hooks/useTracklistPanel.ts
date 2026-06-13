import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getAlbumTracks,
  getPlaylistTracks,
  getQueue,
  getLikedSongs,
  getRecentDevice,
  playTrackInContext,
  playTrackByUri,
  playUriList,
  setShuffleState,
  addToQueue as apiAddToQueue,
  checkSavedTracks,
  saveTracksToLibrary,
  type ContextTrack,
} from '../services/spotifyService';

export type PanelView = 'playlist' | 'album' | 'queue' | 'liked';

const LIKED_PAGE_SIZE = 50;

interface UseTracklistPanelReturn {
  isOpen: boolean;
  isLoading: boolean;
  tracks: ContextTrack[];
  selectedTrackUri: string | null;
  panelView: PanelView;
  isSupportedContext: boolean;
  savedTrackUris: Set<string>;
  isLoadingMoreLiked: boolean;
  likedHasMore: boolean;
  toggleOpen: () => void;
  close: () => void;
  selectTrack: (trackUri: string) => Promise<void>;
  showAlbum: (albumId: string, albumUri: string) => void;
  showPlaylist: () => void;
  showQueue: () => void;
  showLikedSongs: () => Promise<void>;
  loadMoreLikedSongs: () => Promise<void>;
  goBack: () => void;
  addToQueue: (trackUri: string) => Promise<void>;
  saveTrack: (trackUri: string) => Promise<void>;
}

export function useTracklistPanel(
  contextUri: string | null,
  contextType: string | null,
  fallbackAlbum?: { id: string; uri: string } | null,
  currentTrackUri?: string | null,
  refetchPlayback?: (options?: { untilTrackChanges?: boolean }) => Promise<void>,
): UseTracklistPanelReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tracks, setTracks] = useState<ContextTrack[]>([]);
  const [selectedTrackUri, setSelectedTrackUri] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<PanelView>('playlist');
  const [savedTrackUris, setSavedTrackUris] = useState<Set<string>>(new Set());
  const [overrideUri, setOverrideUri] = useState<string | null>(null);
  const [overrideType, setOverrideType] = useState<string | null>(null);
  const [likedOffset, setLikedOffset] = useState(0);
  const [likedHasMore, setLikedHasMore] = useState(true);
  const [isLoadingMoreLiked, setIsLoadingMoreLiked] = useState(false);
  const prevViewRef = useRef<PanelView>('playlist');
  const panelViewRef = useRef<PanelView>('playlist');
  const queueRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    panelViewRef.current = panelView;
  }, [panelView]);

  // Cache tracks per contextUri (not used for queue — always fresh)
  const cacheRef = useRef<Record<string, ContextTrack[]>>({});
  const refetchPlaybackRef = useRef(refetchPlayback);
  refetchPlaybackRef.current = refetchPlayback;
  // Mirror tracks to a ref so selectTrack can read the latest Liked Songs URIs
  // without re-creating the callback on every page-load.
  const tracksRef = useRef<ContextTrack[]>([]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  const checkAndMergeSaved = useCallback(async (trackList: ContextTrack[]) => {
    if (trackList.length === 0) return;
    const ids = trackList.map(t => t.uri.split(':').pop()!).filter(Boolean);
    try {
      const saved = await checkSavedTracks(ids);
      setSavedTrackUris(prev => {
        const next = new Set(prev);
        trackList.forEach((t, i) => { if (saved[i]) next.add(t.uri); });
        return next;
      });
    } catch (err) {
      console.error('Failed to check saved tracks:', err);
    }
  }, []);

  // Whether the current context is fetchable (album or playlist)
  const isSupportedContext = contextType === 'album' || contextType === 'playlist';

  const defaultView: PanelView = isSupportedContext && contextType === 'playlist' ? 'playlist' : 'album';

  const fetchTracksFor = useCallback(async (uri: string, type: string): Promise<ContextTrack[]> => {
    // Use cached if available
    if (cacheRef.current[uri]) {
      const cached = cacheRef.current[uri];
      setTracks(cached);
      checkAndMergeSaved(cached);
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
          checkAndMergeSaved(albumTracks);
          return albumTracks;
        }
        return [];
      }

      cacheRef.current[uri] = result;
      setTracks(result);
      checkAndMergeSaved(result);
      return result;
    } catch (err) {
      console.error('Failed to fetch context tracks:', err);
      setTracks([]);
      return [];
    }
  }, [fallbackAlbum, checkAndMergeSaved]);

  const fetchQueueTracks = useCallback(async (): Promise<ContextTrack[]> => {
    try {
      const result = await getQueue();
      // Queue refresh should only mutate panel tracks while queue view is active.
      if (panelViewRef.current === 'queue') {
        setTracks(result);
        checkAndMergeSaved(result);
      }
      return result;
    } catch (err) {
      console.error('Failed to fetch queue:', err);
      if (panelViewRef.current === 'queue') {
        setTracks([]);
      }
      return [];
    }
  }, [checkAndMergeSaved]);

  const fetchLikedSongsPage = useCallback(async (offset: number, append: boolean): Promise<void> => {
    try {
      const { tracks: newTracks, hasMore } = await getLikedSongs(LIKED_PAGE_SIZE, offset);
      if (panelViewRef.current !== 'liked') return;
      setTracks(prev => append ? [...prev, ...newTracks] : newTracks);
      checkAndMergeSaved(newTracks);
      setLikedOffset(offset + newTracks.length);
      setLikedHasMore(hasMore);
    } catch (err) {
      console.error('Failed to fetch liked songs:', err);
      if (panelViewRef.current === 'liked' && !append) {
        setTracks([]);
      }
      setLikedHasMore(false);
    }
  }, [checkAndMergeSaved]);

  // Clear stale selection when the actual playing track changes (e.g. external skip)
  useEffect(() => {
    setSelectedTrackUri(null);
  }, [currentTrackUri]);

  // When context changes while panel is open, reset overrides and re-fetch
  const prevEffectiveUriRef = useRef<string | null>(null);
  useEffect(() => {
    const effectiveUri = isSupportedContext ? contextUri : fallbackAlbum?.uri ?? null;
    if (prevEffectiveUriRef.current !== null && effectiveUri !== prevEffectiveUriRef.current) {
      // Context changed — always clear stale override URIs so a later back-nav
      // from queue/liked fetches the *new* album/playlist, not the previous one.
      setOverrideUri(null);
      setOverrideType(null);
      // Don't yank the user out of views they explicitly navigated to.
      if (panelView !== 'queue' && panelView !== 'liked') {
        setPanelView(defaultView);
        if (isOpen && effectiveUri) {
          const type = isSupportedContext ? contextType! : 'album';
          fetchTracksFor(effectiveUri, type);
        }
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
      if (queueRefreshTimerRef.current) {
        clearTimeout(queueRefreshTimerRef.current);
        queueRefreshTimerRef.current = null;
      }
      setIsOpen(false);
      setPanelView(defaultView);
      panelViewRef.current = defaultView;
      setOverrideUri(null);
      setOverrideType(null);
    } else {
      setPanelView(defaultView);
      panelViewRef.current = defaultView;
      setOverrideUri(null);
      setOverrideType(null);
      const result = await fetchTracks();
      if (result.length > 0) {
        setIsOpen(true);
      }
    }
  }, [isOpen, fetchTracks, defaultView]);

  const close = useCallback(() => {
    if (queueRefreshTimerRef.current) {
      clearTimeout(queueRefreshTimerRef.current);
      queueRefreshTimerRef.current = null;
    }
    setIsOpen(false);
    setPanelView(defaultView);
    panelViewRef.current = defaultView;
    setOverrideUri(null);
    setOverrideType(null);
  }, [defaultView]);

  const showAlbum = useCallback((_albumId: string, albumUri: string) => {
    prevViewRef.current = panelView;
    setPanelView('album');
    panelViewRef.current = 'album';
    setOverrideUri(albumUri);
    setOverrideType('album');
    // Clear stale tracks only when not cached to prevent old panel tracks flashing
    if (!cacheRef.current[albumUri]) {
      setTracks([]);
      setIsLoading(true);
      fetchTracksFor(albumUri, 'album').finally(() => setIsLoading(false));
    } else {
      fetchTracksFor(albumUri, 'album');
    }
  }, [fetchTracksFor, panelView]);

  const showPlaylist = useCallback(() => {
    prevViewRef.current = panelView;
    setPanelView('playlist');
    panelViewRef.current = 'playlist';
    setOverrideUri(null);
    setOverrideType(null);
    if (contextUri && contextType === 'playlist') {
      // Clear stale tracks only when not cached to prevent old panel tracks flashing
      if (!cacheRef.current[contextUri]) {
        setTracks([]);
        setIsLoading(true);
        fetchTracksFor(contextUri, contextType).finally(() => setIsLoading(false));
      } else {
        fetchTracksFor(contextUri, contextType);
      }
      return;
    }

    // If playlist context is unavailable, gracefully fall back to album tracks.
    if (fallbackAlbum?.uri) {
      setPanelView('album');
      panelViewRef.current = 'album';
      setOverrideUri(fallbackAlbum.uri);
      setOverrideType('album');
      if (!cacheRef.current[fallbackAlbum.uri]) {
        setTracks([]);
        setIsLoading(true);
        fetchTracksFor(fallbackAlbum.uri, 'album').finally(() => setIsLoading(false));
      } else {
        fetchTracksFor(fallbackAlbum.uri, 'album');
      }
      return;
    }

    // No valid source available: clear stale rows and close.
    setTracks([]);
    setIsOpen(false);
  }, [contextUri, contextType, fallbackAlbum?.uri, fetchTracksFor, panelView]);

  const showQueue = useCallback(() => {
    prevViewRef.current = panelView;
    setPanelView('queue');
    panelViewRef.current = 'queue';
    // Queue is never cached — always clear before fetching fresh
    setTracks([]);
    setIsLoading(true);
    fetchQueueTracks().finally(() => setIsLoading(false));
  }, [panelView, fetchQueueTracks]);

  const showLikedSongs = useCallback(async () => {
    prevViewRef.current = panelView;
    setPanelView('liked');
    panelViewRef.current = 'liked';
    setOverrideUri(null);
    setOverrideType(null);
    setTracks([]);
    setLikedOffset(0);
    setLikedHasMore(true);
    setIsLoading(true);
    setIsOpen(true);
    await fetchLikedSongsPage(0, false);
    setIsLoading(false);
  }, [panelView, fetchLikedSongsPage]);

  const loadMoreLikedSongs = useCallback(async () => {
    if (panelViewRef.current !== 'liked') return;
    if (!likedHasMore || isLoadingMoreLiked) return;
    setIsLoadingMoreLiked(true);
    await fetchLikedSongsPage(likedOffset, true);
    setIsLoadingMoreLiked(false);
  }, [likedHasMore, isLoadingMoreLiked, likedOffset, fetchLikedSongsPage]);

  const goBack = useCallback(() => {
    // From Liked Songs → back to Queue (Queue is the only entry point to Liked).
    if (panelViewRef.current === 'liked') {
      showQueue();
      return;
    }
    if (prevViewRef.current === 'album') {
      const albumUri = (overrideType === 'album' ? overrideUri : null) ?? fallbackAlbum?.uri ?? null;
      if (albumUri) {
        setPanelView('album');
        panelViewRef.current = 'album';
        setOverrideUri(albumUri);
        setOverrideType('album');
        if (!cacheRef.current[albumUri]) {
          setTracks([]);
          setIsLoading(true);
          fetchTracksFor(albumUri, 'album').finally(() => setIsLoading(false));
        } else {
          fetchTracksFor(albumUri, 'album');
        }
        return;
      }
    }
    showPlaylist();
  }, [overrideType, overrideUri, fallbackAlbum?.uri, fetchTracksFor, showPlaylist, showQueue]);

  const selectTrack = useCallback(async (trackUri: string) => {
    if (panelView === 'liked') {
      setSelectedTrackUri(trackUri);
      try {
        // Liked Songs is typically opened when nothing is currently playing, which
        // means there's probably no active Spotify device. The play endpoint returns
        // 404 in that case unless we explicitly target one. Look up the user's most
        // recently used device via me/player (still online + most-recent), falling
        // back to the first listed device when no recent session exists.
        const device = await getRecentDevice();

        // Play through the loaded Liked Songs in shuffle order, so Spotify has a
        // list to shuffle through rather than looping the single clicked track.
        // We pass at most 100 URIs (Spotify's cap), starting from the clicked song
        // so it plays first; subsequent tracks shuffle.
        const allUris = tracksRef.current.map(t => t.uri);
        const startIdx = Math.max(0, allUris.indexOf(trackUri));
        const window = allUris.slice(startIdx, startIdx + 100);
        if (window.length > 1) {
          await playUriList(window, trackUri, device?.id);
          // Enable shuffle so the rest of the window plays in random order.
          try { await setShuffleState(true, device?.id); } catch { /* shuffle is best-effort */ }
        } else {
          // Fallback for the unexpected case where we somehow don't have the
          // clicked track in our loaded list — just play the single URI.
          await playTrackByUri(trackUri, device?.id);
        }
        refetchPlaybackRef.current?.({ untilTrackChanges: true });
      } catch (err) {
        console.error('Failed to play liked song:', err);
      }
      return;
    }
    if (panelView === 'queue') {
      // Queue tracks may come from mixed contexts. Prefer context playback when possible,
      // else fall back to direct URI playback.
      setSelectedTrackUri(trackUri);
      try {
        if (queueRefreshTimerRef.current) {
          clearTimeout(queueRefreshTimerRef.current);
          queueRefreshTimerRef.current = null;
        }

        // Prefer the REAL Spotify context (album/playlist) so playback keeps that
        // context intact. If there's no real context (e.g. after Liked Songs
        // auto-shuffle, where Spotify reports context=null), use playUriList with
        // the rest of the queue so Spotify has something to play after the clicked
        // track — otherwise a single-URI play would just loop that one song.
        // The fallbackAlbum is NOT a safe substitute for contextUri here, because
        // a queue row often isn't part of the current track's album and Spotify
        // will reject "play X in album Y" when X doesn't belong to Y.
        if (isSupportedContext && contextUri) {
          await playTrackInContext(contextUri, trackUri);
        } else {
          const allUris = tracksRef.current.map(t => t.uri);
          const startIdx = Math.max(0, allUris.indexOf(trackUri));
          const window = allUris.slice(startIdx, startIdx + 100);
          if (window.length > 1) {
            await playUriList(window, trackUri);
          } else {
            await playTrackByUri(trackUri);
          }
        }

        // Smart retry: poll Spotify until the playing track actually changes,
        // so the album art / animations / colors update within ~300-700ms
        // instead of waiting for the next 3000ms regular poll.
        refetchPlaybackRef.current?.({ untilTrackChanges: true });

        // Don't refresh immediately — Spotify hasn't updated its queue state yet.
        // A single delayed refresh is enough; the current track row will stay
        // visible in the panel until the fresh data arrives.
        queueRefreshTimerRef.current = setTimeout(() => {
          fetchQueueTracks();
        }, 800);
      } catch (err) {
        console.error('Failed to play selected queue track:', err);
      }
      return;
    }
    const activeContextUri = overrideUri ?? (isSupportedContext ? contextUri : fallbackAlbum?.uri ?? null);
    if (!activeContextUri) return;
    setSelectedTrackUri(trackUri);
    try {
      await playTrackInContext(activeContextUri, trackUri);
      // Smart retry: poll Spotify until the playing track actually changes.
      refetchPlaybackRef.current?.({ untilTrackChanges: true });
    } catch (err) {
      console.error('Failed to play track in context:', err);
    }
  }, [contextUri, overrideUri, isSupportedContext, fallbackAlbum, panelView, fetchQueueTracks]);

  const addToQueue = useCallback(async (trackUri: string) => {
    await apiAddToQueue(trackUri);
    // If viewing queue, refresh it to show the newly added track
    if (panelView === 'queue') {
      await fetchQueueTracks();
    }
  }, [panelView, fetchQueueTracks]);

  const saveTrack = useCallback(async (trackUri: string) => {
    const id = trackUri.split(':').pop();
    if (!id) return;
    try {
      await saveTracksToLibrary([id]);
      setSavedTrackUris(prev => new Set([...prev, trackUri]));
    } catch (err) {
      console.error('Failed to save track to library:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (queueRefreshTimerRef.current) {
        clearTimeout(queueRefreshTimerRef.current);
      }
    };
  }, []);

  return {
    isOpen,
    isLoading,
    tracks,
    selectedTrackUri,
    panelView,
    isSupportedContext,
    savedTrackUris,
    isLoadingMoreLiked,
    likedHasMore,
    toggleOpen,
    close,
    selectTrack,
    showAlbum,
    showPlaylist,
    showQueue,
    showLikedSongs,
    loadMoreLikedSongs,
    goBack,
    addToQueue,
    saveTrack,
  };
}
