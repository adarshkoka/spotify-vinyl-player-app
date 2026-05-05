package com.spotifyvinyl.app.service

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.state.PreferencesGlanceStateDefinition
import com.spotifyvinyl.core.model.PlaybackState
import com.spotifyvinyl.widget.VinylWidget
import com.spotifyvinyl.widget.VinylWidgetReceiver
import com.spotifyvinyl.widget.WidgetStateKeys
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Bridges [PlaybackState] from `:core` into the widget's Glance preferences.
 *
 * Two responsibilities:
 *   1. **Track / play state mirror** — every emission of [playbackState] writes
 *      track id, title, artist, art URL, and `isPlaying` into the widget state.
 *   2. **Spin tick driver** — while `isPlaying` is true and at least one widget
 *      instance is on screen, increments `frame_index` every
 *      [WidgetStateKeys.FRAME_INTERVAL_MS] so the disc visually rotates. Stops
 *      the loop on pause / track change / no-widgets.
 *
 * Lifecycle-bound to [PlaybackService.serviceScope]; cancelled when the service
 * is destroyed.
 */
class WidgetStateBridge(
    private val context: Context,
    private val playbackState: StateFlow<PlaybackState>,
    private val scope: CoroutineScope,
) {

    private var spinJob: Job? = null
    private var hasWidgets: Boolean = hasActiveWidgets()

    fun start() {
        scope.launch { observePlaybackState() }
    }

    fun setWidgetsActive(active: Boolean) {
        hasWidgets = active
        if (!active) stopSpin()
        else maybeStartSpin(playbackState.value.isPlaying)
    }

    private suspend fun observePlaybackState() {
        var lastTrackId: String? = null
        playbackState.collectLatest { state ->
            writeMirror(state)
            if (state.track?.id != lastTrackId) {
                lastTrackId = state.track?.id
                resetFrameIndex()
            }
            maybeStartSpin(state.isPlaying)
        }
    }

    private suspend fun writeMirror(state: PlaybackState) {
        forEachWidget { id ->
            updateAppWidgetState(context, PreferencesGlanceStateDefinition, id) { prefs ->
                prefs.toMutablePreferences().apply {
                    val track = state.track
                    if (track != null) {
                        set(WidgetStateKeys.TRACK_ID, track.id)
                        set(WidgetStateKeys.TITLE, track.name)
                        set(WidgetStateKeys.ARTIST, track.artists.joinToString { it.name })
                        set(WidgetStateKeys.ART_URL, track.album.imageUrl.orEmpty())
                    } else {
                        remove(WidgetStateKeys.TRACK_ID)
                        remove(WidgetStateKeys.TITLE)
                        remove(WidgetStateKeys.ARTIST)
                        remove(WidgetStateKeys.ART_URL)
                    }
                    set(WidgetStateKeys.IS_PLAYING, state.isPlaying)
                }
            }
        }
        VinylWidget().updateAll(context)
    }

    private suspend fun resetFrameIndex() {
        forEachWidget { id ->
            updateAppWidgetState(context, PreferencesGlanceStateDefinition, id) { prefs ->
                prefs.toMutablePreferences().apply { set(WidgetStateKeys.FRAME_INDEX, 0) }
            }
        }
    }

    private fun maybeStartSpin(isPlaying: Boolean) {
        if (!isPlaying || !hasWidgets) {
            stopSpin()
            return
        }
        if (spinJob?.isActive == true) return
        spinJob = scope.launch {
            while (isActive) {
                delay(WidgetStateKeys.FRAME_INTERVAL_MS)
                advanceFrame()
            }
        }
    }

    private fun stopSpin() {
        spinJob?.cancel()
        spinJob = null
    }

    private suspend fun advanceFrame() {
        forEachWidget { id ->
            updateAppWidgetState(context, PreferencesGlanceStateDefinition, id) { prefs ->
                prefs.toMutablePreferences().apply {
                    val current = get(WidgetStateKeys.FRAME_INDEX) ?: 0
                    set(WidgetStateKeys.FRAME_INDEX, (current + 1) % WidgetStateKeys.FRAME_COUNT)
                }
            }
        }
        VinylWidget().updateAll(context)
    }

    private suspend fun forEachWidget(action: suspend (GlanceId) -> Unit) {
        val manager = GlanceAppWidgetManager(context)
        val ids = manager.getGlanceIds(VinylWidget::class.java)
        ids.forEach { action(it) }
    }

    private fun hasActiveWidgets(): Boolean {
        val mgr = AppWidgetManager.getInstance(context)
        val component = ComponentName(context, VinylWidgetReceiver::class.java)
        return mgr.getAppWidgetIds(component).isNotEmpty()
    }

    fun stop() {
        stopSpin()
        scope.coroutineContext.cancelChildren()
    }
}
