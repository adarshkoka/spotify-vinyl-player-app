package com.spotifyvinyl.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import androidx.collection.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL

/**
 * Pre-renders the spinning-vinyl frames for the home-screen widget.
 *
 * Per track:
 *  1. Download album art (or read from a previously-cached PNG).
 *  2. Composite it onto a circular disc canvas with concentric grooves so the
 *     art forms the center label of the record.
 *  3. Pre-rotate into [WidgetStateKeys.FRAME_COUNT] frames around the disc center.
 *  4. Persist each frame to `cacheDir/widget_frames/<trackId>/<index>.png` so
 *     subsequent ticks just read PNGs from disk (cheap on the widget update path).
 *
 * Each frame is also held in a small in-memory LRU cache so the per-tick
 * Glance update doesn't even hit the filesystem in the steady state.
 */
class AlbumArtCompositor(
    private val context: Context,
    private val frameSizePx: Int = DEFAULT_FRAME_SIZE_PX,
) {

    private val memoryCache = LruCache<String, Bitmap>(WidgetStateKeys.FRAME_COUNT * 2)

    /**
     * Returns the rotated frame for [trackId] at [frameIndex]. Triggers a one-shot
     * disk render the first time it's requested for a track. Returns null if the
     * art could not be loaded (caller should fall back to the static disc drawable).
     */
    suspend fun frame(trackId: String, artUrl: String?, frameIndex: Int): Bitmap? {
        val key = cacheKey(trackId, frameIndex)
        memoryCache.get(key)?.let { return it }

        val frameFile = frameFile(trackId, frameIndex)
        if (!frameFile.exists()) {
            renderFrames(trackId, artUrl) ?: return null
        }
        val bitmap = withContext(Dispatchers.IO) {
            runCatching { BitmapFactory.decodeFile(frameFile.absolutePath) }.getOrNull()
        } ?: return null
        memoryCache.put(key, bitmap)
        return bitmap
    }

    /** Drops cached frames for tracks other than [keepTrackId]. */
    suspend fun pruneOtherTracks(keepTrackId: String?) = withContext(Dispatchers.IO) {
        val root = framesDir()
        if (!root.exists()) return@withContext
        root.listFiles()?.forEach { dir ->
            if (dir.isDirectory && dir.name != keepTrackId) {
                dir.deleteRecursively()
            }
        }
        // Drop any in-memory entries that don't belong to the kept track.
        val snapshot = memoryCache.snapshot()
        snapshot.keys.forEach { k ->
            if (keepTrackId == null || !k.startsWith("$keepTrackId:")) {
                memoryCache.remove(k)
            }
        }
    }

    private suspend fun renderFrames(trackId: String, artUrl: String?): Unit? = withContext(Dispatchers.IO) {
        val art = artUrl?.let { loadBitmap(it) }
        val baseDisc = buildBaseDisc(art) ?: return@withContext null

        val dir = trackDir(trackId).apply { mkdirs() }
        for (i in 0 until WidgetStateKeys.FRAME_COUNT) {
            val angle = i * (360f / WidgetStateKeys.FRAME_COUNT)
            val rotated = rotate(baseDisc, angle)
            FileOutputStream(File(dir, "$i.png")).use { out ->
                rotated.compress(Bitmap.CompressFormat.PNG, 90, out)
            }
            memoryCache.put(cacheKey(trackId, i), rotated)
        }
        baseDisc.recycle()
        Unit
    }

    private fun buildBaseDisc(art: Bitmap?): Bitmap? {
        val size = frameSizePx
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val cx = size / 2f
        val cy = size / 2f
        val outerR = size * 0.48f
        val labelR = size * 0.22f
        val spindleR = size * 0.018f

        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // Outer black disc
        paint.color = Color.parseColor("#0E0E10")
        canvas.drawCircle(cx, cy, outerR, paint)

        // Concentric grooves
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = size * 0.0033f
        paint.color = Color.parseColor("#1A1A1F")
        val grooveStart = outerR * 0.94f
        val grooveStep = (outerR * 0.94f - labelR * 1.05f) / 6f
        var r = grooveStart
        repeat(6) {
            canvas.drawCircle(cx, cy, r, paint)
            r -= grooveStep
        }
        paint.style = Paint.Style.FILL

        // Album art clipped to the center label circle.
        if (art != null) {
            val artBitmap = makeCircular(art, (labelR * 2).toInt())
            canvas.drawBitmap(artBitmap, cx - labelR, cy - labelR, null)
            artBitmap.recycle()
        } else {
            paint.color = Color.parseColor("#2A2A30")
            canvas.drawCircle(cx, cy, labelR, paint)
        }

        // Spindle hole on top of art so the disc reads as a record.
        paint.color = Color.BLACK
        canvas.drawCircle(cx, cy, spindleR, paint)

        return out
    }

    private fun makeCircular(src: Bitmap, sizePx: Int): Bitmap {
        val out = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        canvas.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 2f, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        val srcRect = Rect(0, 0, src.width, src.height)
        val dstRect = RectF(0f, 0f, sizePx.toFloat(), sizePx.toFloat())
        canvas.drawBitmap(src, srcRect, dstRect, paint)
        return out
    }

    private fun rotate(src: Bitmap, degrees: Float): Bitmap {
        if (degrees == 0f) return src.copy(Bitmap.Config.ARGB_8888, false)
        val matrix = Matrix().apply { postRotate(degrees, src.width / 2f, src.height / 2f) }
        return Bitmap.createBitmap(src, 0, 0, src.width, src.height, matrix, true)
    }

    private fun loadBitmap(url: String): Bitmap? {
        return try {
            URL(url).openStream().use { BitmapFactory.decodeStream(it) }
        } catch (t: Throwable) {
            null
        }
    }

    private fun framesDir() = File(context.cacheDir, "widget_frames")
    private fun trackDir(trackId: String) = File(framesDir(), trackId)
    private fun frameFile(trackId: String, index: Int) = File(trackDir(trackId), "$index.png")
    private fun cacheKey(trackId: String, index: Int) = "$trackId:$index"

    companion object {
        private const val DEFAULT_FRAME_SIZE_PX = 360
    }
}
