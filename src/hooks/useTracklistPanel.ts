import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getAlbumTracks,
  getPlaylistTracks,
  getPlaylistTrackCount,
  getQueue,
  getLikedSongs,
  getLikedSongsByArtist,
  getRecentDevice,
  getUserPlaylists,
  playTrackInContext,
  playTrackByUri,
  playUriList,
  setShuffleState,
  addToQueue as apiAddToQueue,
  checkSavedTracks,
  saveTracksToLibrary,
  type ContextTrack,
  type UserPlaylist,
} from '../services/spotifyService';

export type PanelView = 'album' | 'library' | 'playlist' | 'queue' | 'liked' | 'artist';

const LIKED_PAGE_SIZE = 50;

// A playlist context larger than this is never loaded into the panel — fetching
// every track would choke the UI (Spotify's "Liked Songs", played from a phone,
// arrives as a playlist-typed context that can hold 10K+ tracks). The panel
// defaults to the Library tab instead and the Playlist tab is hidden.
const LARGE_PLAYLIST_THRESHOLD = 500;

interface UseTracklistPanelReturn {
  isOpen: boolean;
  isLoading: boolean;
  tracks: ContextTrack[];
  selectedTrackUri: string | null;
  panelView: PanelView;
  /** True once the current playlist context is known to exceed LARGE_PLAYLIST_THRESHOLD. */
  isContextPlaylistLarge: boolean;
  savedTrackUris: Set<string>;
  isLoadingMoreLiked: boolean;
  likedHasMore: boolean;
  libraryPlaylists: UserPlaylist[];
  isLoadingLibrary: boolean;
  toggleOpen: () => void;
  close: () => void;
  selectTrack: (trackUri: string) => Promise<void>;
  showAlbum: (albumId: string, albumUri: string) => void;
  showLibrary: () => void;
  showPlaylist: (playlistUri?: string) => void;
  showQueue: () => void;
  showLikedSongs: () => Promise<void>;
  showArtist: () => Promise<void>;
  loadMoreLikedSongs: () => Promise<void>;
  addToQueue: (trackUri: string) => Promise<void>;
  saveTrack: (trackUri: string) => Promise<void>;
}

export function useTracklistPanel(
  contextUri: string | null,
  contextType: string | null,
  fallbackAlbum?: { id: string; uri: string } | null,
  currentTrackUri?: string | null,
  refetchPlayback?: (options?: { untilTrackChanges?: boolean }) => Promise<void>,
  currentArtistId?: string | null,
): UseTracklistPanelReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Track lists are split by surface so async writes from one view cannot
  // bleed into another. Previously a single `tracks` state was shared across
  // every panel view — an in-flight Liked Songs page fetch could resolve and
  // append onto whatever the album/playlist/queue view had just loaded,
  // producing the "50 liked songs prepended to the album" leak. `tracks`
  // backs album/playlist/queue; `likedTracks` backs Liked Songs only.
  const [tracks, setTracks] = useState<ContextTrack[]>([]);
  const [likedTracks, setLikedTracks] = useState<ContextTrack[]>([]);
  // Artist view (your liked songs by the now-playing artist) is split out for
  // the same isolation reason as likedTracks — async writes from the artist
  // catalog fetch must never bleed into another view's list.
  const [artistTracks, setArtistTracks] = useState<ContextTrack[]>([]);
  const [selectedTrackUri, setSelectedTrackUri] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<PanelView>('album');
  const [savedTrackUris, setSavedTrackUris] = useState<Set<string>>(new Set());
  const [overrideUri, setOverrideUri] = useState<string | null>(null);
  const [overrideType, setOverrideType] = useState<string | null>(null);
  const [likedHasMore, setLikedHasMore] = useState(true);
  const [isLoadingMoreLiked, setIsLoadingMoreLiked] = useState(false);
  const [libraryPlaylists, setLibraryPlaylists] = useState<UserPlaylist[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  // True once we learn the current playlist context exceeds LARGE_PLAYLIST_THRESHOLD.
  const [isContextPlaylistLarge, setIsContextPlaylistLarge] = useState(false);
  const libraryFetchedRef = useRef(false);
  const panelViewRef = useRef<PanelView>('album');
  const queueRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guards for Liked Songs paging. State-based guards lose races
  // against rapid scroll events because setState is async — by the time React
  // commits `isLoadingMoreLiked = true`, several scroll callbacks have already
  // passed the stale `false` check and started parallel fetches at the same
  // offset, producing duplicate rows in the Liked Songs list.
  const loadingMoreLikedRef = useRef(false);
  const likedOffsetRef = useRef(0);
  // Bumped on every showLikedSongs call. Inflight fetches capture the session
  // they were started in and discard their result if the session has moved on
  // — covers stale fetches that resolve after the user navigated away and
  // back, which would otherwise pollute the new session.
  const likedSessionRef = useRef(0);
  // Per-artist session cache + stale-guard. Keyed by artist id so re-opening the
  // same artist is instant; the session ref discards a fetch whose artist has
  // changed (the now-playing song — and thus the artist — can change mid-fetch).
  const artistCacheRef = useRef<Record<string, ContextTrack[]>>({});
  const artistSessionRef = useRef(0);

  useEffect(() => {
    panelViewRef.current = panelView;
  }, [panelView]);

  // Cache tracks per contextUri (not used for queue — always fresh)
  const cacheRef = useRef<Record<string, ContextTrack[]>>({});
  // Cache playlist track counts per uri so the size check costs one lightweight
  // call per distinct playlist (shared by the context-size effect and the
  // fetch-time guard below).
  const playlistCountCacheRef = useRef<Record<string, number>>({});
  const refetchPlaybackRef = useRef(refetchPlayback);
  refetchPlaybackRef.current = refetchPlayback;
  // Mirror tracks to refs so selectTrack can read the latest URIs without
  // re-creating the callback on every page-load. Liked Songs has its own ref
  // because its state is stored separately.
  const tracksRef = useRef<ContextTrack[]>([]);
  const likedTracksRef = useRef<ContextTrack[]>([]);
  const artistTracksRef = useRef<ContextTrack[]>([]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { likedTracksRef.current = likedTracks; }, [likedTracks]);
  useEffect(() => { artistTracksRef.current = artistTracks; }, [artistTracks]);

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

  // A playlist context past the size threshold is treated as "too large to load".
  // The panel defaults to Library instead of Playlist and never fetches its tracks.
  const defaultView: PanelView =
    contextType === 'playlist' && isContextPlaylistLarge ? 'library'
    : contextType === 'playlist' ? 'playlist'
    : 'album';

  // When the playlist context changes, look up its track count (cheap, no items)
  // to decide whether it's too large to load. Cached per uri so we ask once.
  useEffect(() => {
    if (contextType !== 'playlist' || !contextUri) {
      setIsContextPlaylistLarge(false);
      return;
    }
    const cached = playlistCountCacheRef.current[contextUri];
    if (cached !== undefined) {
      setIsContextPlaylistLarge(cached > LARGE_PLAYLIST_THRESHOLD);
      return;
    }
    let cancelled = false;
    const id = contextUri.split(':').pop()!;
    getPlaylistTrackCount(id)
      .then(count => {
        playlistCountCacheRef.current[contextUri] = count;
        if (!cancelled) setIsContextPlaylistLarge(count > LARGE_PLAYLIST_THRESHOLD);
      })
      .catch(() => { if (!cancelled) setIsContextPlaylistLarge(false); });
    return () => { cancelled = true; };
  }, [contextType, contextUri]);

  const showLibrary = useCallback(() => {
    setPanelView('library');
    panelViewRef.current = 'library';
    setOverrideUri(null);
    setOverrideType(null);
    // Library content (user-owned playlists) is rendered separately from the
    // tracklist body — no track fetch here.
    setTracks([]);
    setIsOpen(true);
    // Fetch the user's owned playlists on first open; subsequent opens reuse
    // the cached list so the grid renders instantly.
    if (!libraryFetchedRef.current) {
      libraryFetchedRef.current = true;
      setIsLoadingLibrary(true);
      getUserPlaylists()
        .then(setLibraryPlaylists)
        .catch(err => {
          console.error('Failed to fetch user playlists:', err);
          libraryFetchedRef.current = false;
        })
        .finally(() => setIsLoadingLibrary(false));
    }
  }, []);

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

      // Hard safety net: never load an oversized playlist's tracks, regardless of
      // which path reached here. Show the Library tab instead. The count is cached
      // (the context-size effect usually populated it already), so this is cheap.
      if (type === 'playlist') {
        let count = playlistCountCacheRef.current[uri];
        if (count === undefined) {
          count = await getPlaylistTrackCount(id);
          playlistCountCacheRef.current[uri] = count;
        }
        if (count > LARGE_PLAYLIST_THRESHOLD) {
          showLibrary();
          return [];
        }
      }

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
  }, [fallbackAlbum, checkAndMergeSaved, showLibrary]);

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

  const fetchLikedSongsPage = useCallback(async (offset: number, append: boolean, session: number): Promise<void> => {
    try {
      const { tracks: newTracks, hasMore } = await getLikedSongs(LIKED_PAGE_SIZE, offset);
      if (session !== likedSessionRef.current) return;
      setLikedTracks(prev => append ? [...prev, ...newTracks] : newTracks);
      checkAndMergeSaved(newTracks);
      likedOffsetRef.current = offset + newTracks.length;
      setLikedHasMore(hasMore);
    } catch (err) {
      console.error('Failed to fetch liked songs:', err);
      if (session !== likedSessionRef.current) return;
      if (!append) {
        setLikedTracks([]);
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
      if (panelView !== 'queue' && panelView !== 'liked' && panelView !== 'library') {
        setPanelView(defaultView);
        if (isOpen && effectiveUri && defaultView !== 'library') {
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
      // Library default (oversized playlist context): open into the playlist grid,
      // which has no body tracks — the track-fetch-then-gate path would never open it.
      if (defaultView === 'library') {
        showLibrary();
        return;
      }
      setPanelView(defaultView);
      panelViewRef.current = defaultView;
      setOverrideUri(null);
      setOverrideType(null);
      const result = await fetchTracks();
      if (result.length > 0) {
        setIsOpen(true);
      }
    }
  }, [isOpen, fetchTracks, defaultView, showLibrary]);

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
  }, [fetchTracksFor]);

  const showPlaylist = useCallback((playlistUri?: string) => {
    setPanelView('playlist');
    panelViewRef.current = 'playlist';

    // Library → playlist navigation: caller passes a specific playlist URI to
    // view. Stash it as an override so fetchTracks targets that playlist.
    if (playlistUri) {
      setOverrideUri(playlistUri);
      setOverrideType('playlist');
      if (!cacheRef.current[playlistUri]) {
        setTracks([]);
        setIsLoading(true);
        fetchTracksFor(playlistUri, 'playlist').finally(() => setIsLoading(false));
      } else {
        fetchTracksFor(playlistUri, 'playlist');
      }
      setIsOpen(true);
      return;
    }

    // No override: show currently-playing playlist.
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
  }, [contextUri, contextType, fallbackAlbum?.uri, fetchTracksFor]);

  const showQueue = useCallback(() => {
    setPanelView('queue');
    panelViewRef.current = 'queue';
    // Queue is never cached — always clear before fetching fresh
    setTracks([]);
    setIsLoading(true);
    fetchQueueTracks().finally(() => setIsLoading(false));
  }, [fetchQueueTracks]);

  const showLikedSongs = useCallback(async () => {
    const session = ++likedSessionRef.current;
    setPanelView('liked');
    panelViewRef.current = 'liked';
    setOverrideUri(null);
    setOverrideType(null);
    likedOffsetRef.current = 0;
    // Hold the load-more lock for the duration of the initial fetch — otherwise
    // a scroll event fired during the fetch (e.g. from preserved scroll position
    // when switching back from another tab) launches a second offset=0 fetch
    // that appends a duplicate copy of the first page.
    loadingMoreLikedRef.current = true;
    setLikedTracks([]);
    setLikedHasMore(true);
    setIsLoading(true);
    setIsOpen(true);
    try {
      await fetchLikedSongsPage(0, false, session);
    } finally {
      if (session === likedSessionRef.current) {
        loadingMoreLikedRef.current = false;
        setIsLoading(false);
      }
    }
  }, [fetchLikedSongsPage]);

  const showArtist = useCallback(async () => {
    if (!currentArtistId) return;
    const artistId = currentArtistId;
    const session = ++artistSessionRef.current;
    setPanelView('artist');
    panelViewRef.current = 'artist';
    setOverrideUri(null);
    setOverrideType(null);
    setIsOpen(true);

    // Re-opening the same artist is instant from the per-session cache. These
    // tracks are all liked-only, so seed savedTrackUris to render filled hearts.
    const cached = artistCacheRef.current[artistId];
    if (cached) {
      setIsLoading(false);
      setArtistTracks(cached);
      setSavedTrackUris(prev => new Set([...prev, ...cached.map(t => t.uri)]));
      return;
    }

    setArtistTracks([]);
    setIsLoading(true);
    try {
      const result = await getLikedSongsByArtist(artistId);
      if (session !== artistSessionRef.current) return; // artist changed mid-fetch
      artistCacheRef.current[artistId] = result;
      setArtistTracks(result);
      setSavedTrackUris(prev => new Set([...prev, ...result.map(t => t.uri)]));
    } catch (err) {
      console.error('Failed to load liked songs by artist:', err);
      if (session === artistSessionRef.current) setArtistTracks([]);
    } finally {
      if (session === artistSessionRef.current) setIsLoading(false);
    }
  }, [currentArtistId]);

  // If the now-playing song (and thus its artist) changes while the Artist tab
  // is open, refetch so the tab follows the current artist. Clicking the tab
  // doesn't double-fire: currentArtistId is unchanged at that moment.
  useEffect(() => {
    if (panelViewRef.current !== 'artist') return;
    showArtist();
  }, [currentArtistId, showArtist]);

  const loadMoreLikedSongs = useCallback(async () => {
    if (panelViewRef.current !== 'liked') return;
    if (!likedHasMore || loadingMoreLikedRef.current) return;
    loadingMoreLikedRef.current = true;
    setIsLoadingMoreLiked(true);
    const session = likedSessionRef.current;
    try {
      await fetchLikedSongsPage(likedOffsetRef.current, true, session);
    } finally {
      if (session === likedSessionRef.current) {
        loadingMoreLikedRef.current = false;
        setIsLoadingMoreLiked(false);
      }
    }
  }, [likedHasMore, fetchLikedSongsPage]);

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
        const allUris = likedTracksRef.current.map(t => t.uri);
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
    if (panelView === 'artist') {
      // Liked-by-artist tracks span many albums with no shared Spotify context,
      // so play them as a URI list (like Liked Songs) targeting the most-recent
      // device for cold starts. No forced shuffle — this is a curated list the
      // user is browsing in order.
      setSelectedTrackUri(trackUri);
      try {
        const device = await getRecentDevice();
        const allUris = artistTracksRef.current.map(t => t.uri);
        const startIdx = Math.max(0, allUris.indexOf(trackUri));
        const window = allUris.slice(startIdx, startIdx + 100);
        if (window.length > 1) {
          await playUriList(window, trackUri, device?.id);
        } else {
          await playTrackByUri(trackUri, device?.id);
        }
        refetchPlaybackRef.current?.({ untilTrackChanges: true });
      } catch (err) {
        console.error('Failed to play artist track:', err);
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
      // Without an active Spotify session the play endpoint returns 404. This
      // happens, for example, when the user picks a playlist from the Library
      // before any device has started playing. Look up the most-recent device
      // and target it explicitly — same fallback the Liked Songs path uses.
      const device = await getRecentDevice();
      await playTrackInContext(activeContextUri, trackUri, device?.id);
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
    tracks: panelView === 'artist' ? artistTracks : panelView === 'liked' ? likedTracks : tracks,
    selectedTrackUri,
    panelView,
    isContextPlaylistLarge,
    savedTrackUris,
    isLoadingMoreLiked,
    likedHasMore,
    libraryPlaylists,
    isLoadingLibrary,
    toggleOpen,
    close,
    selectTrack,
    showAlbum,
    showLibrary,
    showPlaylist,
    showQueue,
    showLikedSongs,
    showArtist,
    loadMoreLikedSongs,
    addToQueue,
    saveTrack,
  };
}
