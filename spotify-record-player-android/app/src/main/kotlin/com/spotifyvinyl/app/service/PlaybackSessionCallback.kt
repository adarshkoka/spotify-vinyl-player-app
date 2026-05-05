package com.spotifyvinyl.app.service

import androidx.media3.common.MediaItem
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService.LibraryParams
import androidx.media3.session.MediaLibraryService.MediaLibrarySession
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.spotifyvinyl.auto.MediaTreeBuilder
import com.spotifyvinyl.core.repo.SpotifyRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.guava.future

/**
 * Bridges browse + custom-action requests from the [MediaLibrarySession] into the
 * [MediaTreeBuilder] (Phase 4) and [SpotifyRepository] (transport already handled
 * by [RemoteSpotifyPlayer]). Custom actions: addToQueue, saveToLibrary.
 *
 * For Phase 2 the tree builder returns a minimal placeholder root. The full
 * web-app-parity hierarchy (cover-art sleeve item, smart fallback, queue, library)
 * is implemented in Phase 4 inside `:auto`.
 */
class PlaybackSessionCallback(
    private val scope: CoroutineScope,
    @Suppress("unused") private val repository: SpotifyRepository,
    private val tree: MediaTreeBuilder,
) : MediaLibrarySession.Callback {

    override fun onGetLibraryRoot(
        session: MediaLibrarySession,
        browser: MediaSession.ControllerInfo,
        params: LibraryParams?,
    ): ListenableFuture<LibraryResult<MediaItem>> =
        Futures.immediateFuture(LibraryResult.ofItem(tree.root(), params))

    override fun onGetItem(
        session: MediaLibrarySession,
        browser: MediaSession.ControllerInfo,
        mediaId: String,
    ): ListenableFuture<LibraryResult<MediaItem>> = scope.future {
        val item = tree.item(mediaId)
        if (item == null) LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE)
        else LibraryResult.ofItem(item, null)
    }

    override fun onGetChildren(
        session: MediaLibrarySession,
        browser: MediaSession.ControllerInfo,
        parentId: String,
        page: Int,
        pageSize: Int,
        params: LibraryParams?,
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> = scope.future {
        val children = tree.children(parentId)
        LibraryResult.ofItemList(ImmutableList.copyOf(children), params)
    }
}
