// web-ui/src/hooks/usePoseFrameStream.js
import { useEffect, useRef, useCallback } from "react"

const FPS = 60
const PUBLISH_HZ = 10

export const usePoseFrameStream = (
    frames = [],
    onPublish = () => {},
    { fps = FPS, publishHz = PUBLISH_HZ, enabled = true, onComplete = () => {} } = {}
) => {
    const reqRef = useRef(null)
    const framesRef = useRef(frames)
    const onPublishRef = useRef(onPublish)
    const onCompleteRef = useRef(onComplete)

    framesRef.current = frames
    onPublishRef.current = onPublish
    onCompleteRef.current = onComplete

    const stop = useCallback(() => {
        if (reqRef.current !== null) {
            cancelAnimationFrame(reqRef.current)
            reqRef.current = null
        }
    }, [])

    useEffect(() => {
        stop()
        if (!enabled || !framesRef.current || framesRef.current.length === 0) {
            return undefined
        }

        let startTime = performance.now()
        let lastPublish = 0
        const frameDuration = 1000 / fps
        const publishInterval = 1000 / publishHz

        const tick = (now) => {
            const elapsed = now - startTime
            let frameIdx = Math.floor(elapsed / frameDuration)

            // 1. Sequence Completion
            if (frameIdx >= framesRef.current.length) {
                frameIdx = framesRef.current.length - 1
                const finalPose = framesRef.current[frameIdx]
                
                // Final visual render & network publish
                window.dispatchEvent(new CustomEvent('hexapod-anim-frame', { detail: finalPose }))
                onPublishRef.current(finalPose)
                
                // Sync React state globally now that the animation is over
                onCompleteRef.current(finalPose)
                stop()
                return
            }

            const currentPose = framesRef.current[frameIdx]

            // 2. High-Speed Visual Update @ 60FPS (Bypasses React Reconciliation)
            window.dispatchEvent(new CustomEvent('hexapod-anim-frame', { detail: currentPose }))

            // 3. Throttled Physical Publish @ 10Hz
            if (now - lastPublish >= publishInterval) {
                onPublishRef.current(currentPose)
                lastPublish = now
            }

            reqRef.current = requestAnimationFrame(tick)
        }

        reqRef.current = requestAnimationFrame(tick)
        return stop
    }, [frames, enabled, fps, publishHz, stop])

    return { stop }
}

export default usePoseFrameStream