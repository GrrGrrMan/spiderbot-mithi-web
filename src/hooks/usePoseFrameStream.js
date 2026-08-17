// web-ui/src/hooks/usePoseFrameStream.js
// Chunk 2 — streams an array of interpolated poses to the robot at <=10Hz.
//
// The firmware control loop runs at 100 Hz with a 2 s command watchdog, and the
// web-ui `publishThrottled` already enforces a 100 ms floor. We publish at
// 120 ms (~8.3 Hz) so every frame is a fresh watchdog reset without tripping the
// throttle. The stream stops automatically at the end of the sequence; call the
// returned `stop()` to halt early (e.g. when the user switches presets).
//
// The publish callback is held in a ref so callers can pass inline closures
// without restarting an in-flight stream; only a new `frames` array (or a
// change of `enabled` / `intervalMs`) restarts it.
import { useEffect, useRef, useCallback } from "react"

const DEFAULT_INTERVAL_MS = 120 // ~8.3 Hz — safely under the 10 Hz firmware throttle

export const usePoseFrameStream = (
    frames = [],
    onPublish = () => {},
    { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = {}
) => {
    const timerRef = useRef(null)
    const indexRef = useRef(0)
    const framesRef = useRef(frames)
    const onPublishRef = useRef(onPublish)

    framesRef.current = frames
    onPublishRef.current = onPublish

    const stop = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [])

    useEffect(() => {
        stop()
        if (!enabled || !framesRef.current || framesRef.current.length === 0) {
            return undefined
        }
        indexRef.current = 0
        timerRef.current = setInterval(() => {
            const pose = framesRef.current[indexRef.current]
            if (pose === undefined) {
                stop()
                return
            }
            onPublishRef.current(pose)
            indexRef.current += 1
        }, intervalMs)
        return stop
        // frames changes identity per stream; keep the publish fn in a ref so
        // new closures don't restart the timer.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frames, enabled, intervalMs, stop])

    return { stop }
}

export default usePoseFrameStream