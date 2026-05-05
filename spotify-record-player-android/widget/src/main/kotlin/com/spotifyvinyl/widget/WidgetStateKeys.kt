package com.spotifyvinyl.widget

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey

/**
 * Glance state keys backing [VinylWidget]. The widget reads these from the
 * default `PreferencesGlanceStateDefinition`; `PlaybackService.WidgetTickDriver`
 * writes them whenever playback state changes or the spin tick fires.
 */
object WidgetStateKeys {
    val TRACK_ID = stringPreferencesKey("track_id")
    val TITLE = stringPreferencesKey("title")
    val ARTIST = stringPreferencesKey("artist")
    val ART_URL = stringPreferencesKey("art_url")
    val IS_PLAYING = booleanPreferencesKey("is_playing")
    /** 0..[FRAME_COUNT]-1; advances every [Config.VINYL_SPIN_DURATION_MS] / [FRAME_COUNT] ms while playing. */
    val FRAME_INDEX = intPreferencesKey("frame_index")

    const val FRAME_COUNT = 9
    /** ~200ms — 9 frames × 200ms = 1800ms full rotation, matching VINYL_SPIN_DURATION_MS. */
    const val FRAME_INTERVAL_MS = 200L
}
