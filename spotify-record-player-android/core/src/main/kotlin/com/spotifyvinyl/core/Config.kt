package com.spotifyvinyl.core

/** Mirrors src/config.ts in the web app. Keep these in sync. */
object Config {
    const val SPOTIFY_API_BASE = "https://api.spotify.com/v1/"
    const val SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com/"

    const val OAUTH_SCOPES =
        "user-read-currently-playing user-read-playback-state user-modify-playback-state " +
                "user-library-read user-library-modify"

    const val TOKEN_REFRESH_LEEWAY_MS = 60_000L

    const val SPOTIFY_POLL_INTERVAL_MS = 3000L

    const val JACKET_ENTER_DURATION_MS = 800L
    const val DISC_EMERGE_DURATION_MS = 750L
    const val DISC_CENTER_DURATION_MS = 750L
    const val DISC_REST_DURATION_MS = 150L
    const val DISC_PLACE_DURATION_MS = 1350L
    const val EJECT_DURATION_MS = 300L
    const val VINYL_SPIN_DURATION_MS = 1800L
    const val GRADIENT_TRANSITION_DURATION_MS = 1500L

    const val SCRUB_MS_PER_DEGREE = 80L
    const val SCRUB_FULL_ROTATION_THRESHOLD_DEG = 690
    const val SCRUB_SEEK_THROTTLE_MS = 300L
}
