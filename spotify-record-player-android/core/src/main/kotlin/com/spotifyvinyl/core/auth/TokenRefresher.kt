package com.spotifyvinyl.core.auth

import com.spotifyvinyl.core.BuildConfig
import com.spotifyvinyl.core.Config
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Token refresh + initial code-exchange. Mirrors `refreshAccessToken()` and the
 * `App.tsx` token-exchange POST. The `Mutex` deduplicates concurrent refresh
 * calls — replacement for the web app's promise-based `isRefreshing` lock in
 * `src/services/spotifyService.ts`.
 */
@Singleton
class TokenRefresher @Inject constructor(
    private val tokenStore: TokenStore,
) {
    private val client = OkHttpClient()
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val tokenAdapter = moshi.adapter(TokenResponse::class.java)
    private val mutex = Mutex()

    /** True if access token is missing or expires within the leeway window. */
    fun needsRefresh(): Boolean {
        val token = tokenStore.accessToken ?: return true
        if (token.isBlank()) return true
        val expiresAt = tokenStore.expiresAt
        return System.currentTimeMillis() >= expiresAt - Config.TOKEN_REFRESH_LEEWAY_MS
    }

    /** Returns the current access token, refreshing first if necessary. */
    suspend fun ensureFreshAccessToken(): String? = mutex.withLock {
        if (!needsRefresh()) return@withLock tokenStore.accessToken
        val refresh = tokenStore.refreshToken ?: return@withLock null
        runCatching { refreshLocked(refresh) }
            .getOrElse {
                tokenStore.emitRefreshFailed()
                null
            }
    }

    /** Forces a refresh — used by the OkHttp authenticator on a 401. */
    suspend fun forceRefresh(): String? = mutex.withLock {
        val refresh = tokenStore.refreshToken ?: return@withLock null
        runCatching { refreshLocked(refresh) }
            .getOrElse {
                tokenStore.emitRefreshFailed()
                null
            }
    }

    /** First-time code → token exchange after successful OAuth callback. */
    suspend fun exchangeAuthorizationCode(code: String, codeVerifier: String): Boolean = mutex.withLock {
        val body = FormBody.Builder()
            .add("client_id", BuildConfig.SPOTIFY_CLIENT_ID)
            .add("grant_type", "authorization_code")
            .add("code", code)
            .add("redirect_uri", BuildConfig.SPOTIFY_REDIRECT_URI)
            .add("code_verifier", codeVerifier)
            .build()
        val resp = postToken(body) ?: return@withLock false
        tokenStore.saveTokens(resp.accessToken, resp.refreshToken, resp.expiresIn)
        true
    }

    private fun refreshLocked(refreshToken: String): String? {
        val body = FormBody.Builder()
            .add("client_id", BuildConfig.SPOTIFY_CLIENT_ID)
            .add("grant_type", "refresh_token")
            .add("refresh_token", refreshToken)
            .build()
        val resp = postToken(body) ?: return null
        tokenStore.saveTokens(resp.accessToken, resp.refreshToken ?: refreshToken, resp.expiresIn)
        return resp.accessToken
    }

    private fun postToken(body: okhttp3.RequestBody): TokenResponse? {
        val req = Request.Builder()
            .url("${Config.SPOTIFY_ACCOUNTS_BASE}api/token")
            .post(body)
            .build()
        client.newCall(req).execute().use { response ->
            if (!response.isSuccessful) return null
            val raw = response.body?.string() ?: return null
            return tokenAdapter.fromJson(raw)
        }
    }

    @JsonClass(generateAdapter = true)
    data class TokenResponse(
        @Json(name = "access_token") val accessToken: String,
        @Json(name = "refresh_token") val refreshToken: String?,
        @Json(name = "expires_in") val expiresIn: Long,
        @Json(name = "scope") val scope: String?,
    )
}
