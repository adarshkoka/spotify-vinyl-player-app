package com.spotifyvinyl.core.auth

import android.net.Uri
import android.util.Base64
import com.spotifyvinyl.core.BuildConfig
import com.spotifyvinyl.core.Config
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Direct Kotlin port of `src/utils/auth.ts` from the web SPA. Same charset, same length,
 * same SHA-256 + base64-url challenge encoding, so the resulting authorize URLs are
 * byte-equivalent to what the web app produces (modulo client_id and redirect_uri).
 */
object SpotifyAuth {

    private const val CHARSET =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"

    private val secureRandom = SecureRandom()

    fun generateCodeVerifier(length: Int = 64): String {
        require(length in 43..128) { "PKCE verifier must be 43..128 chars" }
        val out = StringBuilder(length)
        val buf = ByteArray(length)
        secureRandom.nextBytes(buf)
        for (b in buf) {
            out.append(CHARSET[(b.toInt() and 0xFF) % CHARSET.length])
        }
        return out.toString()
    }

    fun generateCodeChallenge(verifier: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII))
        return Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    fun generateState(): String = generateCodeVerifier(32)

    fun buildAuthorizeUrl(codeChallenge: String, state: String): Uri =
        Uri.parse("${Config.SPOTIFY_ACCOUNTS_BASE}authorize").buildUpon()
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("client_id", BuildConfig.SPOTIFY_CLIENT_ID)
            .appendQueryParameter("scope", Config.OAUTH_SCOPES)
            .appendQueryParameter("code_challenge_method", "S256")
            .appendQueryParameter("code_challenge", codeChallenge)
            .appendQueryParameter("redirect_uri", BuildConfig.SPOTIFY_REDIRECT_URI)
            .appendQueryParameter("state", state)
            .build()
}
