package com.spotifyvinyl.app.login

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.spotifyvinyl.app.MainActivity
import com.spotifyvinyl.app.R
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class LoginActivity : ComponentActivity() {

    private val vm: LoginViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIncomingCallback(intent)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    LoginScreen(
                        viewModel = vm,
                        onLaunchAuth = ::launchAuthorize,
                        onLoggedIn = ::routeToMain,
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIncomingCallback(intent)
    }

    private fun handleIncomingCallback(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "spotify-vinyl" || data.host != "callback") return
        vm.handleCallback(data)
    }

    private fun launchAuthorize(uri: Uri) {
        CustomTabsIntent.Builder().build().launchUrl(this, uri)
    }

    private fun routeToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}

@Composable
private fun LoginScreen(
    viewModel: LoginViewModel,
    onLaunchAuth: (Uri) -> Unit,
    onLoggedIn: () -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    LocalLifecycleOwner.current  // placeholder for future lifecycle observers

    if (state is LoginViewModel.UiState.LoggedIn) {
        onLoggedIn()
        return
    }

    Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            when (state) {
                LoginViewModel.UiState.Idle -> {
                    Text("Spotify Vinyl Player", style = MaterialTheme.typography.headlineSmall)
                    Button(onClick = { onLaunchAuth(viewModel.beginLogin()) }) {
                        Text(text = androidx.compose.ui.res.stringResource(R.string.login_button))
                    }
                }
                LoginViewModel.UiState.Exchanging -> {
                    CircularProgressIndicator()
                    Text("Finishing sign-in…")
                }
                is LoginViewModel.UiState.Error -> {
                    Text(
                        text = (state as LoginViewModel.UiState.Error).message,
                        color = MaterialTheme.colorScheme.error,
                    )
                    Button(onClick = { onLaunchAuth(viewModel.beginLogin()) }) {
                        Text(text = "Try again")
                    }
                }
                LoginViewModel.UiState.LoggedIn -> Unit
            }
        }
    }
}
