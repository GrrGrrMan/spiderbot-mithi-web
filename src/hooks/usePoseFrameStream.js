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
        const activeFrames = framesRef.current
        if (!enabled || !Array.isArray(activeFrames) || activeFrames.length === 0) {
            return undefined
        }

        let startTime = performance.now()
        let lastPublish = 0
        const frameDuration = 1000 / fps
        const publishInterval = 1000 / publishHz

        const tick = (now) => {
            const currentList = framesRef.current
            if (!currentList || !Array.isArray(currentList) || currentList.length === 0) {
                stop()
                return
            }

            const elapsed = now - startTime
            let frameIdx = Math.floor(elapsed / frameDuration)

            // 1. Sequence Completion
            if (frameIdx >= currentList.length) {
                frameIdx = currentList.length - 1
                if (frameIdx >= 0 && frameIdx < currentList.length) {
                    const finalFrame = currentList[frameIdx]
                    if (finalFrame && typeof finalFrame === "object") {
                        const finalPose = finalFrame.pose || finalFrame
                        window.dispatchEvent(new CustomEvent('hexapod-anim-frame', { detail: finalFrame }))
                        if (onPublishRef.current) onPublishRef.current(finalPose)
                        if (onCompleteRef.current) onCompleteRef.current(finalPose)
                    }
                }
                stop()
                return
            }

            if (frameIdx >= 0 && frameIdx < currentList.length) {
                const currentFrame = currentList[frameIdx]
                if (currentFrame && typeof currentFrame === "object") {
                    // 2. High-Speed Visual Update @ 60FPS (carries { pose, twist } to Plotly)
                    window.dispatchEvent(new CustomEvent('hexapod-anim-frame', { detail: currentFrame }))

                    // 3. Throttled Physical Publish @ 10Hz (extracts plain pose for MQTT)
                    if (now - lastPublish >= publishInterval) {
                        const rawPose = currentFrame.pose || currentFrame
                        if (onPublishRef.current) onPublishRef.current(rawPose)
                        lastPublish = now
                    }
                }
            }

            reqRef.current = requestAnimationFrame(tick)
        }

        reqRef.current = requestAnimationFrame(tick)
        return stop
    }, [frames, enabled, fps, publishHz, stop])

    return { stop }
}

export default usePoseFrameStream