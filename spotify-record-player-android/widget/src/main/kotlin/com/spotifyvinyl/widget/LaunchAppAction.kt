package com.spotifyvinyl.widget

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback

/**
 * Opens the full app from the widget. Targets `MainActivity` in `:app` by
 * fully-qualified component to avoid taking a hard `:app` dependency from
 * `:widget`.
 */
class LaunchAppAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            component = ComponentName(
                "com.spotifyvinyl.app",
                "com.spotifyvinyl.app.MainActivity",
            )
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        context.startActivity(intent)
    }
}
