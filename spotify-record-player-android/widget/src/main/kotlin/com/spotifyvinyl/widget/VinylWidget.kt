package com.spotifyvinyl.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.Text
import androidx.glance.text.TextStyle

/**
 * Home-screen vinyl widget. Reads playback state from Glance's preferences
 * datastore (written by `WidgetStateBridge` in :app) and renders:
 *   - composited spinning disc (album art on label, frame index from state)
 *   - tonearm overlay swapping between playing/paused position
 *   - transport row (prev / play-pause / next)
 *   - corner "open in app" affordance (true long-press is reserved by the
 *     launcher, so we surface it as an explicit chevron — see plan)
 */
class VinylWidget : GlanceAppWidget() {

    override val stateDefinition = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { Content() }
    }

    @Composable
    private fun Content() {
        val context = LocalContext.current
        val prefs = currentState<Preferences>()

        val trackId = prefs[WidgetStateKeys.TRACK_ID]
        val title = prefs[WidgetStateKeys.TITLE].orEmpty()
        val artist = prefs[WidgetStateKeys.ARTIST].orEmpty()
        val artUrl = prefs[WidgetStateKeys.ART_URL]
        val isPlaying = prefs[WidgetStateKeys.IS_PLAYING] ?: false
        val frameIndex = (prefs[WidgetStateKeys.FRAME_INDEX] ?: 0)
            .coerceIn(0, WidgetStateKeys.FRAME_COUNT - 1)

        val compositor = remember { AlbumArtCompositor(context.applicationContext) }
        var frameProvider by remember(trackId) {
            mutableStateOf<ImageProvider>(ImageProvider(R.drawable.vinyl_disc_base))
        }
        LaunchedEffect(trackId, frameIndex, artUrl) {
            if (trackId != null) {
                val bitmap = compositor.frame(trackId, artUrl, frameIndex)
                if (bitmap != null) {
                    frameProvider = ImageProvider(bitmap)
                }
            }
        }

        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(ColorProvider(Color(0xFF16161A)))
                .cornerRadius(20.dp)
                .padding(12.dp),
        ) {
            Column(modifier = GlanceModifier.fillMaxSize()) {
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Disc(provider = frameProvider, isPlaying = isPlaying)
                    Spacer(GlanceModifier.width(12.dp))
                    Column(modifier = GlanceModifier.defaultWeight()) {
                        Text(
                            text = title.ifEmpty { "Spotify Vinyl" },
                            maxLines = 2,
                            style = TextStyle(color = ColorProvider(Color.White)),
                        )
                        Spacer(GlanceModifier.height(2.dp))
                        Text(
                            text = artist.ifEmpty { "Tap to open" },
                            maxLines = 1,
                            style = TextStyle(color = ColorProvider(Color(0xFFB6B6BC))),
                        )
                    }
                    Image(
                        provider = ImageProvider(R.drawable.ic_widget_open_app),
                        contentDescription = "Open app",
                        modifier = GlanceModifier
                            .size(20.dp)
                            .clickable(actionRunCallback<LaunchAppAction>()),
                    )
                }
                Spacer(GlanceModifier.height(8.dp))
                TransportRow(isPlaying = isPlaying)
            }
        }
    }

    @Composable
    private fun Disc(provider: ImageProvider, isPlaying: Boolean) {
        Box(
            modifier = GlanceModifier
                .size(96.dp)
                .clickable(actionRunCallback<PlayPauseAction>()),
            contentAlignment = Alignment.TopEnd,
        ) {
            Image(
                provider = provider,
                contentDescription = "Album art",
                contentScale = ContentScale.Fit,
                modifier = GlanceModifier.fillMaxSize(),
            )
            Image(
                provider = ImageProvider(
                    if (isPlaying) R.drawable.vinyl_tonearm_playing
                    else R.drawable.vinyl_tonearm_paused
                ),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = GlanceModifier.size(56.dp),
            )
        }
    }

    @Composable
    private fun TransportRow(isPlaying: Boolean) {
        Row(
            modifier = GlanceModifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TransportButton(
                iconRes = R.drawable.ic_widget_skip_previous,
                description = "Previous",
                onClick = actionRunCallback<SkipPreviousAction>(),
            )
            Spacer(GlanceModifier.width(20.dp))
            TransportButton(
                iconRes = if (isPlaying) R.drawable.ic_widget_pause else R.drawable.ic_widget_play,
                description = if (isPlaying) "Pause" else "Play",
                onClick = actionRunCallback<PlayPauseAction>(),
            )
            Spacer(GlanceModifier.width(20.dp))
            TransportButton(
                iconRes = R.drawable.ic_widget_skip_next,
                description = "Next",
                onClick = actionRunCallback<SkipNextAction>(),
            )
        }
    }

    @Composable
    private fun TransportButton(iconRes: Int, description: String, onClick: Action) {
        Image(
            provider = ImageProvider(iconRes),
            contentDescription = description,
            modifier = GlanceModifier
                .size(36.dp)
                .clickable(onClick),
        )
    }
}
