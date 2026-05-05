package com.spotifyvinyl.core.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Replacement for the web app's `localStorage` token persistence. Wraps
 * `EncryptedSharedPreferences` (AES-256-GCM via Android Keystore master key).
 *
 * Mirrors the keys used in `src/App.tsx` / `src/services/spotifyService.ts`:
 *   - spotify_access_token, spotify_refresh_token, spotify_token_expires_at
 *   - spotify_code_verifier, spotify_auth_state (transient; cleared after exchange)
 */
@Singleton
class TokenStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences = run {
        val key = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "spotify_vinyl_secure",
            key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private val _events = MutableSharedFlow<AuthEvent>(
        extraBufferCapacity = 4,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    val events: SharedFlow<AuthEvent> = _events.asSharedFlow()

    val accessToken: String? get() = prefs.getString(KEY_ACCESS_TOKEN, null)
    val refreshToken: String? get() = prefs.getString(KEY_REFRESH_TOKEN, null)
    val expiresAt: Long get() = prefs.getLong(KEY_EXPIRES_AT, 0L)

    val codeVerifier: String? get() = prefs.getString(KEY_CODE_VERIFIER, null)
    val authState: String? get() = prefs.getString(KEY_AUTH_STATE, null)

    fun isLoggedIn(): Boolean = !accessToken.isNullOrBlank() && !refreshToken.isNullOrBlank()

    fun savePendingLogin(verifier: String, state: String) {
        prefs.edit()
            .putString(KEY_CODE_VERIFIER, verifier)
            .putString(KEY_AUTH_STATE, state)
            .apply()
    }

    fun clearPendingLogin() {
        prefs.edit()
            .remove(KEY_CODE_VERIFIER)
            .remove(KEY_AUTH_STATE)
            .apply()
    }

    fun saveTokens(accessToken: String, refreshToken: String?, expiresInSec: Long) {
        val absExpiry = System.currentTimeMillis() + expiresInSec * 1000L
        prefs.edit().apply {
            putString(KEY_ACCESS_TOKEN, accessToken)
            if (!refreshToken.isNullOrBlank()) putString(KEY_REFRESH_TOKEN, refreshToken)
            putLong(KEY_EXPIRES_AT, absExpiry)
        }.apply()
        _events.tryEmit(AuthEvent.LoggedIn)
    }

    fun clearAll() {
        prefs.edit().clear().apply()
        _events.tryEmit(AuthEvent.LoggedOut)
    }

    sealed interface AuthEvent {
        data object LoggedIn : AuthEvent
        data object LoggedOut : AuthEvent
        data object RefreshFailed : AuthEvent
    }

    fun emitRefreshFailed() {
        _events.tryEmit(AuthEvent.RefreshFailed)
    }

    private companion object {
        const val KEY_ACCESS_TOKEN = "spotify_access_token"
        const val KEY_REFRESH_TOKEN = "spotify_refresh_token"
        const val KEY_EXPIRES_AT = "spotify_token_expires_at"
        const val KEY_CODE_VERIFIER = "spotify_code_verifier"
        const val KEY_AUTH_STATE = "spotify_auth_state"
    }
}
