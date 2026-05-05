package com.spotifyvinyl.core.api

import com.spotifyvinyl.core.auth.TokenRefresher
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/**
 * Attaches the current access token to outbound requests. Proactively refreshes
 * the token if it's within the leeway window (mirrors `ensureValidToken()` in
 * `src/services/spotifyService.ts:63–78`).
 */
class AuthInterceptor @Inject constructor(
    private val tokenRefresher: TokenRefresher,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = runBlocking { tokenRefresher.ensureFreshAccessToken() }
        val authed = if (token.isNullOrBlank()) {
            request
        } else {
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        }
        return chain.proceed(authed)
    }
}
