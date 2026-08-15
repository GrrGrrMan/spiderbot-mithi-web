// web-ui/src/components/camera/StreamViewport.js
//
// P2 Phase B: the actual MJPEG renderer. Uses a plain <img> tag (the ESP32
// CameraServer pushes a multipart/x-mixed-replace stream, which the browser
// displays frame-by-frame). We can't use <video> because the source isn't a
// single video file.
//
// Stall detection strategy (from best-practice research — see
// docs/future-roadmap/camera/README.md §B):
//   - <img>.onLoad timestamps are pushed into a small ring buffer.
//   - A 3-second watchdog (setInterval) flips to "stalled" if no fresh frame
//     has arrived, then bumps the <img> key so React remounts the node —
//     which forces a fresh HTTP connection and breaks the "frozen last frame"
//     failure mode documented for MJPEG streams.
//   - Reconnect is capped: at most one remount per 5 seconds, otherwise we
//     declare "connection lost" and the parent renders OfflinePlaceholder.
//   - FPS is measured from the last ~10 onLoad timestamps via EMA.
//
// Cache-busting (?t=…) is only appended on remount, not per-frame —
// otherwise it would defeat the multipart stream.

import React, { useEffect, useRef, useState, useCallback } from "react"
import StreamStatusBar from "./StreamStatusBar"

const STALL_MS = 3000 // watchdog threshold
const REMOUNT_COOLDOWN_MS = 5000 // minimum gap between reconnects
const FPS_WINDOW = 10 // ring-buffer depth for FPS calc
const FPS_TICK_MS = 2000 // how often we recompute the EMA

const StreamViewport = ({ url, isConnected }) => {
    const [imgKey, setImgKey] = useState(0)
    const [stalled, setStalled] = useState(false)
    const [lost, setLost] = useState(false)
    const [fps, setFps] = useState(0)
    const [cacheBust, setCacheBust] = useState(0)

    // Mutable refs survive renders without retriggering effects.
    const lastLoadRef = useRef(0)
    const loadTimesRef = useRef([])
    const lastRemountRef = useRef(0)
    const emaFpsRef = useRef(0)
    const mountStartRef = useRef(Date.now())

    // Reset all state when the source URL changes (e.g. precedence flipped).
    useEffect(() => {
        lastLoadRef.current = 0
        loadTimesRef.current = []
        lastRemountRef.current = 0
        emaFpsRef.current = 0
        mountStartRef.current = Date.now()
        setImgKey(k => k + 1) // force fresh <img>
        setCacheBust(Date.now())
        setStalled(false)
        setLost(false)
        setFps(0)
    }, [url])

    // Stall watchdog: every STALL_MS, check the gap since last frame.
    useEffect(() => {
        if (!url) return undefined
        const id = setInterval(() => {
            const now = Date.now()
            // If no frame has ever arrived, anchor "last frame" at mount time
            // so the gap grows on every tick. On the first tick, gap ==
            // STALL_MS which is *not* > STALL_MS (we want a one-tick grace
            // period to let the multipart handshake complete); from tick 2
            // onward, gap > STALL_MS and the normal stalled logic kicks in.
            const mountStart = mountStartRef.current
            const lastFrame =
                lastLoadRef.current === 0 ? mountStart : lastLoadRef.current
            const gap = now - lastFrame

            if (gap > STALL_MS) {
                setStalled(true)
                if (now - lastRemountRef.current > REMOUNT_COOLDOWN_MS) {
                    lastRemountRef.current = now
                    setImgKey(k => k + 1)
                    setCacheBust(now)
                } else if (gap > STALL_MS + REMOUNT_COOLDOWN_MS) {
                    setLost(true)
                }
            } else if (stalled) {
                // Recovered — fresh frame arrived.
                setStalled(false)
                setLost(false)
            }
        }, STALL_MS)
        return () => clearInterval(id)
    }, [url, stalled])

    // FPS sampler — converts the ring buffer of timestamps to a smoothed FPS.
    useEffect(() => {
        if (!url) return undefined
        const id = setInterval(() => {
            const times = loadTimesRef.current
            if (times.length < 2) return
            const span = times[times.length - 1] - times[0]
            if (span <= 0) return
            const instant = ((times.length - 1) * 1000) / span
            emaFpsRef.current = emaFpsRef.current === 0
                ? instant
                : 0.6 * emaFpsRef.current + 0.4 * instant
            setFps(emaFpsRef.current)
        }, FPS_TICK_MS)
        return () => clearInterval(id)
    }, [url])

    const handleLoad = useCallback(() => {
        const now = Date.now()
        lastLoadRef.current = now
        const buf = loadTimesRef.current
        buf.push(now)
        if (buf.length > FPS_WINDOW) buf.shift()
        setStalled(false)
        setLost(false)
    }, [])

    const handleError = useCallback(() => {
        setStalled(true)
    }, [])

    // url=null (parent hasn't resolved one yet) or lost → render nothing.
    // The parent (CameraView) decides what to show instead.
    if (!url || lost) return null

    const imgSrc = `${url}${url.includes("?") ? "&" : "?"}t=${cacheBust}`

    const wrapperStyle = {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
    }

    const imgStyle = {
        maxWidth: "100%",
        maxHeight: "100%",
        width: "auto",
        height: "auto",
        objectFit: "contain",
        display: "block",
    }

    return (
        <div style={wrapperStyle} data-testid="stream-viewport">
            <img
                key={imgKey}
                src={imgSrc}
                alt="Hexapod MJPEG stream"
                style={imgStyle}
                onLoad={handleLoad}
                onError={handleError}
                data-testid="stream-image"
            />
            <StreamStatusBar
                fps={fps}
                resolutionHint={isConnected ? "VGA · q12" : null}
                status={stalled ? "stalled — reconnecting…" : null}
            />
        </div>
    )
}

export default StreamViewport

