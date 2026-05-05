package com.spotifyvinyl.widget

import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

/**
 * AppWidgetProvider for the vinyl widget. Receives the standard
 * `APPWIDGET_UPDATE` broadcast and delegates to [VinylWidget].
 *
 * State writes (track / playback flags / spin frame) are pushed by
 * `WidgetStateBridge` in :app via `updateAppWidgetState`. The receiver itself
 * is intentionally thin — it doesn't poll Spotify or talk to PlaybackService.
 */
class VinylWidgetReceiver : GlanceAppWidgetReceiver() {

    override val glanceAppWidget: GlanceAppWidget = VinylWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        // First widget instance was added — wake the playback service so it
        // starts pushing state updates and spin ticks.
        notifyWidgetActive(context, active = true)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // Last widget instance was removed — stop driving spin ticks.
        notifyWidgetActive(context, active = false)
    }

    private fun notifyWidgetActive(context: Context, active: Boolean) {
        val intent = Intent(ACTION_WIDGET_STATE).apply {
            setClassName(
                "com.spotifyvinyl.app",
                "com.spotifyvinyl.app.service.PlaybackService",
            )
            putExtra(EXTRA_ACTIVE, active)
        }
        runCatching { context.startService(intent) }
    }

    companion object {
        const val ACTION_WIDGET_STATE = "com.spotifyvinyl.app.action.WIDGET_STATE"
        const val EXTRA_ACTIVE = "active"
    }
}
