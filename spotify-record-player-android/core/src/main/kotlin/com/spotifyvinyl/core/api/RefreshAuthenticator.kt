package com.spotifyvinyl.core.api

import com.spotifyvinyl.core.auth.TokenRefresher
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject

/**
 * OkHttp [Authenticator] handles 401s — same role as the retry-on-401 branch in
 * `spotifyApiCall()` in `src/services/spotifyService.ts:112–123`. The shared
 * [TokenRefresher] mutex guarantees only one concurrent refresh.
 */
class RefreshAuthenticator @Inject constructor(
    private val tokenRefresher: TokenRefresher,
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null
        val newToken = runBlocking { tokenRefresher.forceRefresh() } ?: return null
        return response.request.newBuilder()
            .header("Authorization", "Bearer $newToken")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
