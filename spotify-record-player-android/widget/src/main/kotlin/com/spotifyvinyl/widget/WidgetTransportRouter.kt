package com.spotifyvinyl.widget

import android.content.ComponentName
import android.content.Context
import android.content.Intent

/**
 * The widget needs to issue transport commands but lives in a Glance worker
 * thread without a `MediaController`. We keep this fire-and-forget by sending
 * a service intent that `PlaybackService` (in :app) translates into player
 * commands. `:widget` only knows the action string; `:app` owns the receiver.
 */
internal object WidgetTransportRouter {

    private const val SERVICE_PKG = "com.spotifyvinyl.app"
    private const val SERVICE_CLASS = "com.spotifyvinyl.app.service.PlaybackService"

    const val ACTION_TRANSPORT = "com.spotifyvinyl.app.action.TRANSPORT"
    const val EXTRA_COMMAND = "command"

    fun dispatch(context: Context, command: String) {
        val intent = Intent(ACTION_TRANSPORT).apply {
            component = ComponentName(SERVICE_PKG, SERVICE_CLASS)
            putExtra(EXTRA_COMMAND, command)
        }
        // Foreground-service start is only allowed from a background context if
        // the service is already running. The widget assumes PlaybackService is
        // alive (it is, while a session exists). Fall back to a regular start
        // if not — Android may downgrade to a regular service which is fine
        // since we're only sending a command, not initiating new playback.
        runCatching { context.startService(intent) }
    }
}
