# Spotify Vinyl — Native Android

Native Android sibling to the existing `spotify-record-player-app` web SPA. Adds a home-screen widget and Android Auto integration. The Android app remote-controls the user's Spotify session via the **Spotify App Remote SDK** (primary) with a **Spotify Web API fallback**; it never streams Spotify audio itself.

See `../spotify-record-player-app/spotify_vinyl_player_android_plan.md` for the original goals and the approved implementation plan.

## Project layout

```
spotify-record-player-android/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle/libs.versions.toml      version catalog
├── gradle.properties
├── local.properties.example       copy to local.properties and fill in
├── core/                          shared module — auth, API, repository, models
├── app/                           full phone app (Compose, MainActivity, LoginActivity, PlaybackService)
├── widget/                        home-screen widget (Jetpack Glance)
└── auto/                          Android Auto MediaTreeBuilder + custom actions
```

## First-time setup

1. Install Android Studio Ladybug or newer.
2. Open this folder as a project. Android Studio downloads the Gradle wrapper on first sync.
3. Copy `local.properties.example` to `local.properties` and fill in:
    - `sdk.dir` — your Android SDK path
    - `SPOTIFY_CLIENT_ID` — register a new Android client at <https://developer.spotify.com/dashboard> (separate from the web app's client ID) with redirect URI `spotify-vinyl://callback`
4. Sync Gradle. The `core` module's `BuildConfig.SPOTIFY_CLIENT_ID` and `BuildConfig.SPOTIFY_REDIRECT_URI` will pick up your local properties.

## Spotify Developer Dashboard

Register the Android app as a separate dashboard entry from the web app:
- Redirect URI: `spotify-vinyl://callback`
- Android package: `com.spotifyvinyl.app`
- SHA-1 fingerprint of your debug/release signing key (required for Spotify App Remote SDK)
- Required scopes: `user-read-currently-playing user-read-playback-state user-modify-playback-state user-library-read user-library-modify`

## Build / run

```
./gradlew :app:installDebug
```

For Android Auto testing, see `docs/dhu-setup.md` (created in Phase 5).
