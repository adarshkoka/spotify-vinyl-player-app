package com.spotifyvinyl.core.api.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CurrentlyPlayingDto(
    val item: TrackDto?,
    @Json(name = "is_playing") val isPlaying: Boolean,
    @Json(name = "progress_ms") val progressMs: Long?,
    val timestamp: Long?,
    val context: ContextDto?,
)

@JsonClass(generateAdapter = true)
data class ContextDto(
    val type: String,
    val uri: String,
    val href: String?,
)

@JsonClass(generateAdapter = true)
data class TrackDto(
    val id: String,
    val uri: String,
    val name: String,
    val album: AlbumDto,
    val artists: List<ArtistDto>,
    @Json(name = "duration_ms") val durationMs: Long,
)

@JsonClass(generateAdapter = true)
data class AlbumDto(
    val id: String,
    val uri: String,
    val name: String,
    val images: List<ImageDto>,
    @Json(name = "total_tracks") val totalTracks: Int?,
)

@JsonClass(generateAdapter = true)
data class ArtistDto(
    val id: String,
    val uri: String,
    val name: String,
)

@JsonClass(generateAdapter = true)
data class ImageDto(
    val url: String,
    val height: Int?,
    val width: Int?,
)

@JsonClass(generateAdapter = true)
data class AlbumTracksResponse(
    val items: List<TrackDto>,
    val next: String?,
)

@JsonClass(generateAdapter = true)
data class PlaylistTracksResponse(
    val items: List<PlaylistTrackItem>,
    val next: String?,
)

@JsonClass(generateAdapter = true)
data class PlaylistTrackItem(
    val track: TrackDto?,
)

@JsonClass(generateAdapter = true)
data class QueueResponse(
    @Json(name = "currently_playing") val currentlyPlaying: TrackDto?,
    val queue: List<TrackDto>,
)

@JsonClass(generateAdapter = true)
data class PlayBody(
    @Json(name = "context_uri") val contextUri: String? = null,
    @Json(name = "uris") val uris: List<String>? = null,
    val offset: Offset? = null,
)

@JsonClass(generateAdapter = true)
data class Offset(val uri: String)

@JsonClass(generateAdapter = true)
data class SaveTracksBody(val ids: List<String>)
