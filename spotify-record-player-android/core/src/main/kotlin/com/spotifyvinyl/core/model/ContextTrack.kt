package com.spotifyvinyl.core.model

data class ContextTrack(
    val uri: String,
    val name: String,
    val artists: String,
    val trackNumber: Int,
    val durationMs: Long,
    val albumImageUrl: String? = null,
    val isSaved: Boolean = false,
)
