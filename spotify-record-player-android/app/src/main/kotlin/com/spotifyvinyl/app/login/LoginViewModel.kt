package com.spotifyvinyl.app.login

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spotifyvinyl.core.auth.SpotifyAuth
import com.spotifyvinyl.core.auth.TokenRefresher
import com.spotifyvinyl.core.auth.TokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val tokenStore: TokenStore,
    private val tokenRefresher: TokenRefresher,
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState>(
        if (tokenStore.isLoggedIn()) UiState.LoggedIn else UiState.Idle
    )
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    /** Generates a fresh PKCE pair, persists it, returns the authorize URI. */
    fun beginLogin(): Uri {
        val verifier = SpotifyAuth.generateCodeVerifier()
        val state = SpotifyAuth.generateState()
        tokenStore.savePendingLogin(verifier, state)
        val challenge = SpotifyAuth.generateCodeChallenge(verifier)
        return SpotifyAuth.buildAuthorizeUrl(challenge, state)
    }

    /** Validates state and exchanges the code for tokens. */
    fun handleCallback(uri: Uri) {
        val incomingState = uri.getQueryParameter("state")
        val savedState = tokenStore.authState
        if (incomingState == null || incomingState != savedState) {
            _uiState.value = UiState.Error("Auth state mismatch — try again.")
            tokenStore.clearPendingLogin()
            return
        }

        val error = uri.getQueryParameter("error")
        if (error != null) {
            _uiState.value = UiState.Error("Spotify returned: $error")
            tokenStore.clearPendingLogin()
            return
        }

        val code = uri.getQueryParameter("code")
        val verifier = tokenStore.codeVerifier
        if (code == null || verifier == null) {
            _uiState.value = UiState.Error("Missing authorization code.")
            tokenStore.clearPendingLogin()
            return
        }

        _uiState.value = UiState.Exchanging
        viewModelScope.launch {
            val ok = tokenRefresher.exchangeAuthorizationCode(code, verifier)
            tokenStore.clearPendingLogin()
            _uiState.value =
                if (ok) UiState.LoggedIn else UiState.Error("Token exchange failed.")
        }
    }

    sealed interface UiState {
        data object Idle : UiState
        data object Exchanging : UiState
        data object LoggedIn : UiState
        data class Error(val message: String) : UiState
    }
}
