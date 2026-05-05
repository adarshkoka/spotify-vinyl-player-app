package com.spotifyvinyl.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.appwidget.action.ActionCallback

/**
 * Glance action callbacks for the widget transport row + disc tap.
 *
 * Each callback fires a transport command at [PlaybackService] via the
 * [WidgetTransportRouter] (a tiny shim in `:app` that turns these into
 * `MediaController` calls — kept in `:app` so this module doesn't depend on
 * media3-session at runtime). The router is resolved by ServiceLoader: the
 * widget module declares the *interface*, the app module supplies the impl.
 */
object WidgetActionKeys {
    val ACTION = ActionParameters.Key<String>("action")

    const val PLAY_PAUSE = "play_pause"
    const val SKIP_NEXT = "skip_next"
    const val SKIP_PREVIOUS = "skip_previous"
}

class PlayPauseAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        WidgetTransportRouter.dispatch(context, WidgetActionKeys.PLAY_PAUSE)
    }
}

class SkipNextAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        WidgetTransportRouter.dispatch(context, WidgetActionKeys.SKIP_NEXT)
    }
}

class SkipPreviousAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        WidgetTransportRouter.dispatch(context, WidgetActionKeys.SKIP_PREVIOUS)
    }
}

internal fun playPauseParams() = actionParametersOf(WidgetActionKeys.ACTION to WidgetActionKeys.PLAY_PAUSE)
internal fun skipNextParams() = actionParametersOf(WidgetActionKeys.ACTION to WidgetActionKeys.SKIP_NEXT)
internal fun skipPreviousParams() = actionParametersOf(WidgetActionKeys.ACTION to WidgetActionKeys.SKIP_PREVIOUS)
