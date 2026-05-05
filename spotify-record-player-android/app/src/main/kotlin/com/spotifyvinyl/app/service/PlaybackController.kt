package com.spotifyvinyl.app.service

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Thin helper for connecting a Media3 [MediaController] to [PlaybackService].
 * Used by `MainActivity` (and later the widget / Auto) as the read interface
 * over the [MediaLibrarySession]. Mirrors how the web app's `useSpotifyPlayback`
 * subscribes to playback updates — but here the bus is the MediaSession itself.
 */
object PlaybackControllerFactory {

    /** Suspends until a [MediaController] is connected and emits state changes. */
    fun connect(context: Context): Flow<ControllerSnapshot> = callbackFlow {
        val token = SessionToken(
            context.applicationContext,
            ComponentName(context.applicationContext, PlaybackService::class.java),
        )
        val builder = MediaController.Builder(context.applicationContext, token).buildAsync()

        var listener: Player.Listener? = null
        var controller: MediaController? = null

        builder.addListener({
            val ctl = builder.get()
            controller = ctl
            val l = object : Player.Listener {
                override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) =
                    trySendSnapshot(ctl)

                override fun onIsPlayingChanged(isPlaying: Boolean) =
                    trySendSnapshot(ctl)

                override fun onPositionDiscontinuity(
                    oldPosition: Player.PositionInfo,
                    newPosition: Player.PositionInfo,
                    reason: Int,
                ) = trySendSnapshot(ctl)

                private fun trySendSnapshot(c: MediaController) {
                    trySend(c.snapshot())
                }
            }
            listener = l
            ctl.addListener(l)
            trySend(ctl.snapshot())
        }, MoreExecutors.directExecutor())

        awaitClose {
            listener?.let { controller?.removeListener(it) }
            controller?.release()
        }
    }

    private fun MediaController.snapshot(): ControllerSnapshot = ControllerSnapshot(
        title = mediaMetadata.title?.toString(),
        artist = mediaMetadata.artist?.toString(),
        artworkUri = mediaMetadata.artworkUri,
        isPlaying = isPlaying,
    )
}

data class ControllerSnapshot(
    val title: String?,
    val artist: String?,
    val artworkUri: android.net.Uri?,
    val isPlaying: Boolean,
)
