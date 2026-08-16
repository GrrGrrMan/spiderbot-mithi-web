// web-ui/src/components/camera/StreamViewport.js
//
// P2 Phase C fix (2026-08-16): transport switched from a bare no-cors <img>
// pointed straight at the multipart stream to fetch() + ReadableStream MJPEG
// parsing -> blob: URL per frame.
//
// WHY: Chromium fires <img>.onLoad once per CONNECTION (not per frame) for
// multipart/x-mixed-replace, so the old onLoad-based FPS + stall watchdog mis-
// fired on a healthy stream (FPS always "<1", spurious remounts, eventual false
// "lost"). Parsing frames ourselves gives REAL per-frame events: honest FPS,
// honest stall detection, and clean "lost"/recovery signalling to the parent
// (which shows OfflinePlaceholder).
//
// Contract: url must be CORS-accessible (fetch). The CAM's :81/stream now emits
// Access-Control-Allow-Origin: * (CameraServer.cpp). The boundary token is read
// from the response Content-Type, so this parses both the mock fixture and the
// ESP32 CameraServer wire format generically.

import React, { useEffect, useRef, useState, useCallback } from "react"
import StreamStatusBar from "./StreamStatusBar"

const STALL_MS = 3000 // no frame for this long -> "stalled" badge
const LOST_MS = 8000 // no frame for this long -> notify parent (placeholder)
const FPS_WINDOW_MS = 2000 // sliding window for the FPS EMA

const StreamViewport = ({ url, isConnected, onStatus }) => {
    const [blobUrl, setBlobUrl] = useState(null)
    const [stalled, setStalled] = useState(false)
    const [fps, setFps] = useState(0)

    const genRef = useRef(0) // invalidates stale async work on url/unmount
    const aborterRef = useRef(null)
    const lastFrameRef = useRef(0)
    const emaFpsRef = useRef(0)
    const lostRef = useRef(false)
    const onStatusRef = useRef(onStatus)
    onStatusRef.current = onStatus

    const notifyLost = useCallback(lost => {
        lostRef.current = lost
        if (onStatusRef.current) onStatusRef.current({ lost })
    }, [])

    useEffect(() => {
        if (!url) {
            setBlobUrl(prev => {
                if (prev) URL.revokeObjectURL(prev)
                return null
            })
            return undefined
        }

        const gen = ++genRef.current
        const ac = new AbortController()
        aborterRef.current = ac

        let buffer = "" // latin1 binary string; JPEG bytes map 1:1 to chars
        const bytesToLatin1 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s }
        const frames = []
        let lastFrame = Date.now()
        let connected = false

        const pushFrame = bytes => {
            if (genRef.current !== gen) return
            const now = Date.now()
            setBlobUrl(prev => {
                if (prev) URL.revokeObjectURL(prev)
                return URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }))
            })
            lastFrame = now
            lastFrameRef.current = now
            frames.push(now)
            while (
                frames.length > 2 &&
                frames[frames.length - 1] - frames[0] > FPS_WINDOW_MS
            ) {
                frames.shift()
            }
            if (frames.length >= 2) {
                const span = frames[frames.length - 1] - frames[0]
                if (span > 0) {
                    const instant = ((frames.length - 1) * 1000) / span
                    emaFpsRef.current =
                        emaFpsRef.current === 0
                            ? instant
                            : 0.6 * emaFpsRef.current + 0.4 * instant
                    setFps(emaFpsRef.current)
                }
            }
            setStalled(false)
            if (lostRef.current) notifyLost(false)
        }

        const run = async () => {
            try {
                const res = await fetch(url, { signal: ac.signal })
                if (genRef.current !== gen) return
                if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`)
                connected = true

                const ct = res.headers.get("content-type") || ""
                const bm = /boundary=([^\s;]+)/i.exec(ct)
                const boundary = bm ? bm[1] : "frame"
                const marker = "--" + boundary
                const hdrEndTok = "\r\n\r\n"

                const reader = res.body.getReader()
                for (;;) {
                    const { value, done } = await reader.read()
                    if (genRef.current !== gen) return
                    if (done) break
                    buffer += bytesToLatin1(value)

                    let mi = buffer.indexOf(marker)
                    while (mi !== -1) {
                        const hs = buffer.indexOf(hdrEndTok, mi + marker.length)
                        if (hs === -1) break // header not fully arrived yet
                        const header = buffer.slice(mi + marker.length, hs)
                        const m = /Content-Length:\s*(\d+)/i.exec(header)
                        if (!m) break
                        const len = parseInt(m[1], 10)
                        const js = hs + hdrEndTok.length
                        const frameEnd = js + len
                        if (buffer.length < frameEnd) break // frame incomplete
                        const frameStr = buffer.slice(js, frameEnd)
                        const bytes = new Uint8Array(len)
                        for (let i = 0; i < len; i++)
                            bytes[i] = frameStr.charCodeAt(i) & 0xff
                        pushFrame(bytes)
                        buffer = buffer.slice(frameEnd)
                        mi = buffer.indexOf(marker)
                    }
                }
            } catch (err) {
                if (genRef.current !== gen) return
                if (err && err.name === "AbortError") return
                // Refused / reset before we ever got frames -> definitely lost.
                if (!connected) notifyLost(true)
            }
        }
        run()

        // Stall/lost watchdog over real frame-arrival timestamps.
        const id = setInterval(() => {
            if (genRef.current !== gen) return
            const gap = Date.now() - lastFrame
            if (gap > LOST_MS) {
                setStalled(true)
                notifyLost(true)
            } else if (gap > STALL_MS) {
                setStalled(true)
            } else {
                setStalled(false)
            }
        }, 1000)

        return () => {
            genRef.current++
            ac.abort()
            clearInterval(id)
            setBlobUrl(prev => {
                if (prev) URL.revokeObjectURL(prev)
                return null
            })
        }
    }, [url, notifyLost])

    // url null, or never-arrived stream, or lost (parent owns the placeholder).
    if (!url || !blobUrl || lostRef.current) return null

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
                src={blobUrl}
                alt="Hexapod MJPEG stream"
                style={imgStyle}
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
