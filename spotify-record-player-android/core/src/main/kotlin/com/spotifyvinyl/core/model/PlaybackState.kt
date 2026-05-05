package com.spotifyvinyl.core.model

data class PlaybackState(
    val track: TrackInfo?,
    val isPlaying: Boolean,
    val progressMs: Long,
    val durationMs: Long,
    val context: PlaybackContext?,
) {
    companion object {
        val EMPTY = PlaybackState(
            track = null,
            isPlaying = false,
            progressMs = 0L,
            durationMs = 0L,
            context = null,
        )
    }
}

data class TrackInfo(
    val id: String,
    val uri: String,
    val name: String,
    val artists: List<ArtistInfo>,
    val album: AlbumInfo,
    val durationMs: Long,
)

data class ArtistInfo(
    val id: String,
    val uri: String,
    val name: String,
)

data class AlbumInfo(
    val id: String,
    val uri: String,
    val name: String,
    val imageUrl: String?,
    val totalTracks: Int?,
)

data class PlaybackContext(
    val type: String,
    val uri: String,
)
