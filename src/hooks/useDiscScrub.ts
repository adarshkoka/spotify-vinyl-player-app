import { useState, useRef, useCallback, useEffect } from 'react';
import { seekToPosition, resumePlayback } from '../services/spotifyService';
import { vibrate } from '../utils/haptics';
import {
  SCRUB_MS_PER_DEGREE,
  SCRUB_FULL_ROTATION_THRESHOLD,
  SCRUB_SEEK_THROTTLE_MS,
  HAPTIC_SCRUB_TICK_MS,
  HAPTIC_SCRUB_TICK_DEGREES,
  HAPTIC_SKIP_MS,
  HAPTIC_PLAY_MS,
  HAPTIC_PAUSE_MS,
} from '../config';

export type ScrubDirection = 'none' | 'forward' | 'backward';
export type LedSkip = 'none' | 'skip-next' | 'skip-prev';

interface UseDiscScrubOptions {
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  canScrub: boolean;
  hapticsEnabled: boolean;
  onSkipNext: () => void;
  onSkipBack: () => void;
}

interface UseDiscScrubReturn {
  isScrubbing: boolean;
  scrubAngle: number;
  scrubDirection: ScrubDirection;
  ledSkip: LedSkip;
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
}

function getAngleFromCenter(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
}

export function useDiscScrub({
  progressMs,
  durationMs,
  isPlaying,
  canScrub,
  hapticsEnabled,
  onSkipNext,
  onSkipBack,
}: UseDiscScrubOptions): UseDiscScrubReturn {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubAngle, setScrubAngle] = useState(0);
  const [scrubDirection, setScrubDirection] = useState<ScrubDirection>('none');
  const [ledSkip, setLedSkip] = useState<LedSkip>('none');

  const totalDeltaRef = useRef(0);
  const lastAngleRef = useRef(0);
  const lastSeekRef = useRef(0);
  const progressAtStartRef = useRef(0);
  const elementRef = useRef<DOMRect | null>(null);
  const wasPlayingRef = useRef(false);
  const skippedRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const skipBlinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Haptics: only fire on touch input, and track the last rotation at which a
  // scrub tick was emitted so ticks stay distance-quantized (not time-based).
  const isTouchRef = useRef(false);
  const lastTickDeltaRef = useRef(0);

  // Refs for stable callbacks in event listeners
  const onSkipNextRef = useRef(onSkipNext);
  const onSkipBackRef = useRef(onSkipBack);
  const durationMsRef = useRef(durationMs);
  const hapticsEnabledRef = useRef(hapticsEnabled);
  onSkipNextRef.current = onSkipNext;
  onSkipBackRef.current = onSkipBack;
  durationMsRef.current = durationMs;
  hapticsEnabledRef.current = hapticsEnabled;

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!elementRef.current) return;
    const currentAngle = getAngleFromCenter(e.clientX, e.clientY, elementRef.current);
    let delta = currentAngle - lastAngleRef.current;

    // Normalize delta to [-180, 180] to handle wraparound
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    totalDeltaRef.current += delta;
    lastAngleRef.current = currentAngle;

    // Only activate scrubbing after the pointer has moved meaningfully.
    // This lets a simple tap pass through as a click (play/pause).
    if (!hasDraggedRef.current) {
      if (Math.abs(totalDeltaRef.current) < 3) return;
      hasDraggedRef.current = true;
      setIsScrubbing(true);
    }

    if (skippedRef.current) return;

    setScrubAngle(totalDeltaRef.current);

    // Update scrub direction for LED indicators
    if (totalDeltaRef.current > 3) {
      setScrubDirection('forward');
    } else if (totalDeltaRef.current < -3) {
      setScrubDirection('backward');
    } else {
      setScrubDirection('none');
    }

    // Light "groove tick" haptic, distance-quantized: one pulse per
    // HAPTIC_SCRUB_TICK_DEGREES of rotation in either direction. Advancing the
    // baseline by whole increments keeps the tick count proportional to distance
    // while a fast flick can't machine-gun the motor.
    if (isTouchRef.current) {
      const movedSinceTick = totalDeltaRef.current - lastTickDeltaRef.current;
      if (Math.abs(movedSinceTick) >= HAPTIC_SCRUB_TICK_DEGREES) {
        lastTickDeltaRef.current +=
          Math.trunc(movedSinceTick / HAPTIC_SCRUB_TICK_DEGREES) * HAPTIC_SCRUB_TICK_DEGREES;
        vibrate(HAPTIC_SCRUB_TICK_MS, hapticsEnabledRef.current);
      }
    }

    // Instant skip when full rotation threshold is crossed mid-drag
    if (Math.abs(totalDeltaRef.current) >= SCRUB_FULL_ROTATION_THRESHOLD) {
      skippedRef.current = true;
      // Heavy "ka-chunk" to mark the track skip / go-back.
      if (isTouchRef.current) vibrate(HAPTIC_SKIP_MS, hapticsEnabledRef.current);
      const skipType: LedSkip = totalDeltaRef.current > 0 ? 'skip-next' : 'skip-prev';
      setLedSkip(skipType);
      if (skipBlinkTimerRef.current) clearTimeout(skipBlinkTimerRef.current);
      skipBlinkTimerRef.current = setTimeout(() => setLedSkip('none'), 400);
      setScrubDirection('none');
      setIsScrubbing(false);
      setScrubAngle(0);

      // Remove listeners immediately
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUpRef.current);

      if (totalDeltaRef.current > 0) {
        onSkipNextRef.current();
      } else {
        onSkipBackRef.current();
      }

      // Ensure playback resumes after skip if song was playing
      if (wasPlayingRef.current) {
        setTimeout(() => resumePlayback().catch(() => {}), 500);
      }
      return;
    }

    // Throttled seek
    const now = performance.now();
    if (now - lastSeekRef.current >= SCRUB_SEEK_THROTTLE_MS && durationMsRef.current > 0) {
      lastSeekRef.current = now;
      const seekMs = progressAtStartRef.current + totalDeltaRef.current * SCRUB_MS_PER_DEGREE;
      const clampedMs = Math.max(0, Math.min(seekMs, durationMsRef.current));
      seekToPosition(clampedMs).catch(() => {});
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);

    // Tap with no meaningful drag — let the click event handle play/pause.
    // The disc tap toggles playback, so buzz a light pulse when it will pause
    // (tonearm lifts off) or a heavier needle-drop thud when it will play.
    if (!hasDraggedRef.current) {
      if (isTouchRef.current) {
        vibrate(wasPlayingRef.current ? HAPTIC_PAUSE_MS : HAPTIC_PLAY_MS, hapticsEnabledRef.current);
      }
      setScrubDirection('none');
      setIsScrubbing(false);
      setScrubAngle(0);
      return;
    }

    // If we already skipped mid-drag, nothing to do
    if (skippedRef.current) return;

    const totalDelta = totalDeltaRef.current;
    const wasPlaying = wasPlayingRef.current;

    setScrubDirection('none');
    setIsScrubbing(false);
    setScrubAngle(0);

    // Final seek to exact position, then auto-resume if was playing
    if (durationMsRef.current > 0) {
      const seekMs = progressAtStartRef.current + totalDelta * SCRUB_MS_PER_DEGREE;
      const clampedMs = Math.max(0, Math.min(seekMs, durationMsRef.current));
      seekToPosition(clampedMs).catch(() => {});
    }

    // Resume playback with delay to ensure seek completes
    if (wasPlaying) {
      setTimeout(() => resumePlayback().catch(() => {}), 300);
    }
  }, [handlePointerMove]);

  // Keep a ref to handlePointerUp so handlePointerMove can remove it
  const handlePointerUpRef = useRef(handlePointerUp);
  handlePointerUpRef.current = handlePointerUp;

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!canScrub) return;
    // Do NOT call e.preventDefault() here — it suppresses the synthetic click
    // event on mobile, which would break tap-to-pause. touch-action:none on the
    // element handles scroll/zoom prevention instead.
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    elementRef.current = rect;

    const angle = getAngleFromCenter(e.clientX, e.clientY, rect);
    lastAngleRef.current = angle;
    totalDeltaRef.current = 0;
    lastSeekRef.current = 0;
    lastTickDeltaRef.current = 0;
    isTouchRef.current = e.pointerType === 'touch';
    progressAtStartRef.current = progressMs;
    wasPlayingRef.current = isPlaying;
    skippedRef.current = false;
    hasDraggedRef.current = false;

    // Don't set isScrubbing yet — wait until actual movement crosses threshold
    setScrubAngle(0);

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUpRef.current);
  }, [canScrub, isPlaying, progressMs, handlePointerMove]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUpRef.current);
      if (skipBlinkTimerRef.current) clearTimeout(skipBlinkTimerRef.current);
    };
  }, [handlePointerMove]);

  return {
    isScrubbing,
    scrubAngle,
    scrubDirection,
    ledSkip,
    handlers: { onPointerDown },
  };
}
