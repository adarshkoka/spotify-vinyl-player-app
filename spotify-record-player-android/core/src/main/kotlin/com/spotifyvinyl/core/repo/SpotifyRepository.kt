package com.spotifyvinyl.core.repo

import com.spotifyvinyl.core.Config
import com.spotifyvinyl.core.api.SpotifyApi
import com.spotifyvinyl.core.api.dto.CurrentlyPlayingDto
import com.spotifyvinyl.core.api.dto.PlayBody
import com.spotifyvinyl.core.api.dto.SaveTracksBody
import com.spotifyvinyl.core.api.dto.TrackDto
import com.spotifyvinyl.core.model.AlbumInfo
import com.spotifyvinyl.core.model.ArtistInfo
import com.spotifyvinyl.core.model.ContextTrack
import com.spotifyvinyl.core.model.PlaybackContext
import com.spotifyvinyl.core.model.PlaybackState
import com.spotifyvinyl.core.model.TrackInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single source of truth for playback state. App Remote callbacks push updates
 * into this repository when the Spotify app is connected; otherwise we fall
 * back to polling `/me/player/currently-playing` at [Config.SPOTIFY_POLL_INTERVAL_MS]
 * (mirrors `useSpotifyPlayback.ts` in the web app).
 *
 * App Remote integration is added in a follow-up commit; for now, [start]
 * unconditionally enables Web API polling so Phase 2 wiring can proceed.
 */
@Singleton
class SpotifyRepository @Inject constructor(
    private val api: SpotifyApi,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _playbackState = MutableStateFlow(PlaybackState.EMPTY)
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    private var pollJob: Job? = null

    fun start() {
        if (pollJob?.isActive == true) return
        pollJob = scope.launch {
            while (true) {
                fetchOnce()
                delay(Config.SPOTIFY_POLL_INTERVAL_MS)
            }
        }
    }

    fun stop() {
        pollJob?.cancel()
        pollJob = null
    }

    suspend fun refreshNow() {
        fetchOnce()
    }

    private suspend fun fetchOnce() {
        runCatching { api.getCurrentlyPlaying() }
            .onSuccess { resp ->
                if (!resp.isSuccessful) return@onSuccess
                val body = resp.body() ?: run {
                    _playbackState.value = PlaybackState.EMPTY
                    return@onSuccess
                }
                _playbackState.value = body.toPlaybackState()
            }
    }

    suspend fun togglePlayback() {
        val current = _playbackState.value
        if (current.isPlaying) api.pause() else api.resume()
        delay(300)
        fetchOnce()
    }

    suspend fun skipNext() {
        api.skipNext()
        delay(300)
        fetchOnce()
    }

    suspend fun skipPrevious() {
        api.skipPrevious()
        delay(300)
        fetchOnce()
    }

    suspend fun seekTo(positionMs: Long) {
        val safe = positionMs.coerceAtLeast(0)
        api.seek(safe)
    }

    suspend fun playInContext(contextUri: String, trackUri: String) {
        api.playInContext(PlayBody(contextUri = contextUri, offset = com.spotifyvinyl.core.api.dto.Offset(trackUri)))
        delay(300)
        fetchOnce()
    }

    suspend fun playTrackByUri(trackUri: String) {
        api.playInContext(PlayBody(uris = listOf(trackUri)))
        delay(300)
        fetchOnce()
    }

    suspend fun addToQueue(trackUri: String) {
        api.addToQueue(trackUri)
    }

    suspend fun saveTrack(trackId: String) {
        api.saveTracks(SaveTracksBody(ids = listOf(trackId)))
    }

    suspend fun checkSaved(trackIds: List<String>): List<Boolean> {
        if (trackIds.isEmpty()) return emptyList()
        val results = mutableListOf<Boolean>()
        trackIds.chunked(50).forEach { chunk ->
            runCatching { api.checkSavedTracks(chunk.joinToString(",")) }
                .onSuccess { resp ->
                    if (resp.isSuccessful) {
                        results += resp.body() ?: List(chunk.size) { false }
                    } else {
                        results += List(chunk.size) { false }
                    }
                }
                .onFailure { results += List(chunk.size) { false } }
        }
        return results
    }

    suspend fun getAlbumTracks(albumId: String): List<ContextTrack> {
        val resp = runCatching { api.getAlbumTracks(albumId) }.getOrNull() ?: return emptyList()
        if (!resp.isSuccessful) return emptyList()
        return resp.body()?.items.orEmpty().mapIndexed { idx, t -> t.toContextTrack(idx + 1) }
    }

    suspend fun getPlaylistTracks(playlistId: String): List<ContextTrack> {
        val resp = runCatching { api.getPlaylistTracks(playlistId) }.getOrNull() ?: return emptyList()
        if (!resp.isSuccessful) return emptyList()
        return resp.body()?.items
            .orEmpty()
            .mapNotNull { it.track }
            .mapIndexed { idx, t -> t.toContextTrack(idx + 1) }
    }

    suspend fun getQueue(): List<ContextTrack> {
        val resp = runCatching { api.getQueue() }.getOrNull() ?: return emptyList()
        if (!resp.isSuccessful) return emptyList()
        val body = resp.body() ?: return emptyList()
        val combined = buildList {
            body.currentlyPlaying?.let { add(it) }
            addAll(body.queue)
        }
        return combined.mapIndexed { idx, t -> t.toContextTrack(idx + 1) }
    }
}

private fun CurrentlyPlayingDto.toPlaybackState(): PlaybackState {
    val itemDto = item ?: return PlaybackState.EMPTY
    return PlaybackState(
        track = itemDto.toTrackInfo(),
        isPlaying = isPlaying,
        progressMs = progressMs ?: 0L,
        durationMs = itemDto.durationMs,
        context = context?.let { PlaybackContext(type = it.type, uri = it.uri) },
    )
}

private fun TrackDto.toTrackInfo(): TrackInfo = TrackInfo(
    id = id,
    uri = uri,
    name = name,
    durationMs = durationMs,
    artists = artists.map { ArtistInfo(id = it.id, uri = it.uri, name = it.name) },
    album = AlbumInfo(
        id = album.id,
        uri = album.uri,
        name = album.name,
        imageUrl = album.images.firstOrNull()?.url,
        totalTracks = album.totalTracks,
    ),
)

private fun TrackDto.toContextTrack(position: Int): ContextTrack = ContextTrack(
    uri = uri,
    name = name,
    artists = artists.joinToString(", ") { it.name },
    trackNumber = position,
    durationMs = durationMs,
    albumImageUrl = album.images.firstOrNull()?.url,
)
