package com.spotifyvinyl.core.api

import com.spotifyvinyl.core.api.dto.AlbumTracksResponse
import com.spotifyvinyl.core.api.dto.CurrentlyPlayingDto
import com.spotifyvinyl.core.api.dto.PlayBody
import com.spotifyvinyl.core.api.dto.PlaylistTracksResponse
import com.spotifyvinyl.core.api.dto.QueueResponse
import com.spotifyvinyl.core.api.dto.SaveTracksBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Mirrors `src/services/spotifyService.ts` endpoints. Auth header is injected
 * by [AuthInterceptor]; 401s are handled by [RefreshAuthenticator].
 */
interface SpotifyApi {

    @GET("me/player/currently-playing")
    suspend fun getCurrentlyPlaying(): Response<CurrentlyPlayingDto>

    @PUT("me/player/play")
    suspend fun resume(): Response<Unit>

    @PUT("me/player/play")
    suspend fun playInContext(@Body body: PlayBody): Response<Unit>

    @PUT("me/player/pause")
    suspend fun pause(): Response<Unit>

    @POST("me/player/next")
    suspend fun skipNext(): Response<Unit>

    @POST("me/player/previous")
    suspend fun skipPrevious(): Response<Unit>

    @PUT("me/player/seek")
    suspend fun seek(@Query("position_ms") positionMs: Long): Response<Unit>

    @GET("me/player/queue")
    suspend fun getQueue(): Response<QueueResponse>

    @POST("me/player/queue")
    suspend fun addToQueue(@Query("uri") uri: String): Response<Unit>

    @GET("albums/{albumId}/tracks")
    suspend fun getAlbumTracks(
        @Path("albumId") albumId: String,
        @Query("limit") limit: Int = 50,
    ): Response<AlbumTracksResponse>

    @GET("playlists/{playlistId}/tracks")
    suspend fun getPlaylistTracks(
        @Path("playlistId") playlistId: String,
        @Query("limit") limit: Int = 50,
    ): Response<PlaylistTracksResponse>

    @GET("me/tracks/contains")
    suspend fun checkSavedTracks(@Query("ids") commaIds: String): Response<List<Boolean>>

    @PUT("me/tracks")
    suspend fun saveTracks(@Body body: SaveTracksBody): Response<Unit>
}
