package com.spotifyvinyl.auto

import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.spotifyvinyl.core.repo.SpotifyRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Builds the browse hierarchy that's exposed to Android Auto (and any future
 * `MediaBrowser` clients). Phase 2 ships a minimal placeholder root so the
 * service compiles and the session callback wiring works; Phase 4 replaces
 * [children] with the full web-app-parity model from `useTracklistPanel.ts`:
 *
 *     ROOT
 *       ├── [Now Playing Sleeve]    BROWSABLE, icon = current album art
 *       ├── Current Album           BROWSABLE
 *       ├── Current Playlist        BROWSABLE  (when context.type == 'playlist')
 *       ├── Queue                   BROWSABLE  (always-fresh)
 *       └── Liked Songs             BROWSABLE
 */
@Singleton
class MediaTreeBuilder @Inject constructor(
    @Suppress("unused") private val repository: SpotifyRepository,
) {

    fun root(): MediaItem = MediaItem.Builder()
        .setMediaId(ROOT_ID)
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle("Spotify Vinyl")
                .setIsBrowsable(true)
                .setIsPlayable(false)
                .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)
                .build()
        )
        .build()

    fun item(mediaId: String): MediaItem? = if (mediaId == ROOT_ID) root() else null

    fun children(@Suppress("UNUSED_PARAMETER") parentId: String): List<MediaItem> = emptyList()

    companion object {
        const val ROOT_ID = "spotify_vinyl_root"
    }
}
