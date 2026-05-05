package com.spotifyvinyl.app.service

import android.app.PendingIntent
import android.content.Intent
import android.os.Looper
import androidx.media3.common.Player
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import com.spotifyvinyl.app.MainActivity
import com.spotifyvinyl.auto.MediaTreeBuilder
import com.spotifyvinyl.core.repo.SpotifyRepository
import com.spotifyvinyl.widget.VinylWidgetReceiver
import com.spotifyvinyl.widget.WidgetTransportRouter
import com.spotifyvinyl.widget.WidgetActionKeys
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import javax.inject.Inject

/**
 * The single foreground service that owns the [MediaSession]. Widget, lock screen,
 * Bluetooth, and Android Auto all bind here. Audio is not produced — the player
 * is a [RemoteSpotifyPlayer] that proxies transport commands to Spotify.
 */
@AndroidEntryPoint
class PlaybackService : MediaLibraryService() {

    @Inject lateinit var repository: SpotifyRepository
    @Inject lateinit var mediaTreeBuilder: MediaTreeBuilder

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private var librarySession: MediaLibrarySession? = null
    private var player: RemoteSpotifyPlayer? = null
    private var widgetBridge: WidgetStateBridge? = null

    override fun onCreate() {
        super.onCreate()

        repository.start()

        val sessionPlayer = RemoteSpotifyPlayer(
            looper = Looper.getMainLooper(),
            repository = repository,
            scope = serviceScope,
        )
        player = sessionPlayer

        librarySession = MediaLibrarySession.Builder(
            this,
            sessionPlayer,
            PlaybackSessionCallback(serviceScope, repository, mediaTreeBuilder),
        )
            .setSessionActivity(buildSessionActivityPendingIntent())
            .build()

        widgetBridge = WidgetStateBridge(
            context = applicationContext,
            playbackState = repository.playbackState,
            scope = serviceScope,
        ).also { it.start() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            WidgetTransportRouter.ACTION_TRANSPORT -> {
                handleTransport(intent.getStringExtra(WidgetTransportRouter.EXTRA_COMMAND))
                return START_NOT_STICKY
            }
            VinylWidgetReceiver.ACTION_WIDGET_STATE -> {
                val active = intent.getBooleanExtra(VinylWidgetReceiver.EXTRA_ACTIVE, false)
                widgetBridge?.setWidgetsActive(active)
                return START_NOT_STICKY
            }
        }
        return super.onStartCommand(intent, flags, startId)
    }

    private fun handleTransport(command: String?) {
        val player = player ?: return
        when (command) {
            WidgetActionKeys.PLAY_PAUSE -> {
                if (player.isPlaying) player.pause() else player.play()
            }
            WidgetActionKeys.SKIP_NEXT -> {
                if (player.isCommandAvailable(Player.COMMAND_SEEK_TO_NEXT)) player.seekToNext()
            }
            WidgetActionKeys.SKIP_PREVIOUS -> {
                if (player.isCommandAvailable(Player.COMMAND_SEEK_TO_PREVIOUS)) player.seekToPrevious()
            }
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? =
        librarySession

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Keep playing if the user removes the launcher activity — the active
        // playback stays controllable from the widget / lock screen / Auto.
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        widgetBridge?.stop()
        widgetBridge = null
        librarySession?.release()
        librarySession = null
        player?.release()
        player = null
        repository.stop()
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun buildSessionActivityPendingIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getActivity(this, 0, intent, flags)
    }
}
