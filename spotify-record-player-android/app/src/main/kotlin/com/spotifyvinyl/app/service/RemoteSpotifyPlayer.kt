package com.spotifyvinyl.app.service

import android.net.Uri
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.spotifyvinyl.core.model.PlaybackState
import com.spotifyvinyl.core.model.TrackInfo
import com.spotifyvinyl.core.repo.SpotifyRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Media3 [SimpleBasePlayer] that does NOT play audio locally — it bridges
 * [SpotifyRepository.playbackState] into Media3's state model and forwards
 * transport commands back to the repository (which dispatches them to App
 * Remote / the Spotify Web API). Audio is rendered by Spotify itself; we
 * are always a remote.
 *
 * This is the abstraction the Glance widget, Auto's MediaBrowser, and the
 * lock-screen / notification all observe. There is exactly one MediaSession
 * across all surfaces.
 */
class RemoteSpotifyPlayer(
    looper: Looper,
    private val repository: SpotifyRepository,
    private val scope: CoroutineScope,
) : SimpleBasePlayer(looper) {

    private val availableCommands: Player.Commands = Player.Commands.Builder()
        .addAll(
            Player.COMMAND_PLAY_PAUSE,
            Player.COMMAND_PREPARE,
            Player.COMMAND_SEEK_TO_NEXT,
            Player.COMMAND_SEEK_TO_PREVIOUS,
            Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
            Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
            Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
            Player.COMMAND_SEEK_TO_MEDIA_ITEM,
            Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
            Player.COMMAND_GET_METADATA,
            Player.COMMAND_GET_TIMELINE,
            Player.COMMAND_RELEASE,
        )
        .build()

    init {
        // Re-read state and notify observers whenever the repository updates.
        scope.launch(Dispatchers.Main.immediate) {
            repository.playbackState.collect { invalidateState() }
        }
    }

    override fun getState(): State {
        val snapshot = repository.playbackState.value
        return State.Builder()
            .setAvailableCommands(availableCommands)
            .setPlaybackState(if (snapshot.track == null) Player.STATE_IDLE else Player.STATE_READY)
            .setPlayWhenReady(
                snapshot.isPlaying,
                Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST
            )
            .setPlaylist(snapshot.toPlaylist())
            .setCurrentMediaItemIndex(if (snapshot.track == null) 0 else 0)
            .setContentPositionMs { snapshot.progressMs }
            .setContentBufferedPositionMs { snapshot.progressMs }
            .build()
    }

    override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
        scope.launch {
            // Repository.togglePlayback() inspects current state; that's idempotent
            // with what Media3 is asking for as long as we keep the session in sync.
            val current = repository.playbackState.value.isPlaying
            if (current != playWhenReady) repository.togglePlayback()
        }
        return Futures.immediateVoidFuture()
    }

    override fun handleSeek(
        mediaItemIndex: Int,
        positionMs: Long,
        seekCommand: Int,
    ): ListenableFuture<*> {
        when (seekCommand) {
            Player.COMMAND_SEEK_TO_NEXT,
            Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> scope.launch { repository.skipNext() }

            Player.COMMAND_SEEK_TO_PREVIOUS,
            Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> scope.launch { repository.skipPrevious() }

            else -> if (positionMs >= 0) scope.launch { repository.seekTo(positionMs) }
        }
        return Futures.immediateVoidFuture()
    }

    override fun handleRelease(): ListenableFuture<*> {
        repository.stop()
        return Futures.immediateVoidFuture()
    }
}

private fun PlaybackState.toPlaylist(): List<SimpleBasePlayer.MediaItemData> {
    val info = track ?: return emptyList()
    return listOf(info.toMediaItemData(durationMs))
}

private fun TrackInfo.toMediaItemData(durationMs: Long): SimpleBasePlayer.MediaItemData {
    val metadata = MediaMetadata.Builder()
        .setTitle(name)
        .setArtist(artists.joinToString(", ") { it.name })
        .setAlbumTitle(album.name)
        .apply { album.imageUrl?.let { setArtworkUri(Uri.parse(it)) } }
        .setIsBrowsable(false)
        .setIsPlayable(true)
        .build()

    val mediaItem = MediaItem.Builder()
        .setMediaId(uri)
        .setUri(uri)
        .setMediaMetadata(metadata)
        .build()

    return SimpleBasePlayer.MediaItemData.Builder(uri)
        .setMediaItem(mediaItem)
        .setDurationUs(durationMs * 1_000L)
        .setIsSeekable(true)
        .setIsDynamic(false)
        .build()
}
