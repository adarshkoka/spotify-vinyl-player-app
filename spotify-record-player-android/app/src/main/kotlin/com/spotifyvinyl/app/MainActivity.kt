package com.spotifyvinyl.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.spotifyvinyl.app.login.LoginActivity
import com.spotifyvinyl.app.service.PlaybackControllerFactory
import com.spotifyvinyl.core.auth.TokenStore
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Placeholder host. Real composition (vinyl player UI, panels, scrubbing) lands
 * in later phases. Currently:
 *   - routes to [LoginActivity] when no token is present
 *   - binds a [androidx.media3.session.MediaController] to [com.spotifyvinyl.app.service.PlaybackService]
 *     and shows the current track as a smoke test for the Phase 2 wiring
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var tokenStore: TokenStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!tokenStore.isLoggedIn()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    NowPlayingSmokeTest()
                }
            }
        }
    }
}

@Composable
private fun NowPlayingSmokeTest() {
    val context = LocalContext.current
    val flow = remember { PlaybackControllerFactory.connect(context) }
    val snapshot by flow.collectAsState(initial = null)

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
    ) {
        Text(
            text = "Spotify Vinyl — signed in",
            style = MaterialTheme.typography.headlineSmall,
        )
        if (snapshot == null) {
            Text("Connecting to MediaSession…")
        } else {
            Text("Track: ${snapshot?.title ?: "—"}")
            Text("Artist: ${snapshot?.artist ?: "—"}")
            Text(if (snapshot?.isPlaying == true) "Playing" else "Paused / idle")
        }
        Text(
            text = "Player UI lands in a later phase.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}
