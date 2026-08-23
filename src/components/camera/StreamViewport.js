// FILE: src/components/camera/StreamViewport.js
import React, { useEffect, useRef, useState, useCallback } from "react"
import StreamStatusBar from "./StreamStatusBar"

const STALL_MS = 3000
const LOST_MS = 8000
const FPS_WINDOW_MS = 2000

export const StreamViewport = ({ url, isConnected, onStatus }) => {
    const [blobUrl, setBlobUrl] = useState(null)
    const [stalled, setStalled] = useState(false)
    const [fps, setFps] = useState(0)

    const aborterRef = useRef(null)
    const lastFrameRef = useRef(0)
    const emaFpsRef = useRef(0)
    const lastFpsUpdateRef = useRef(0)
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

        let isCancelled = false
        const ac = new AbortController()
        aborterRef.current = ac

        const frames = []
        let lastFrame = Date.now()
        let connected = false

        // Typed buffer queue
        let chunks = []
        let totalLen = 0

        const pushFrame = (jpegBytes) => {
            if (isCancelled) return
            const now = Date.now()

            // 1. Create blob directly from Uint8Array slice (zero string conversion)
            const blob = new Blob([jpegBytes], { type: "image/jpeg" })
            const nextUrl = URL.createObjectURL(blob)

            setBlobUrl(prev => {
                if (prev) URL.revokeObjectURL(prev)
                return nextUrl
            })

            lastFrame = now
            lastFrameRef.current = now
            frames.push(now)

            while (frames.length > 2 && frames[frames.length - 1] - frames[0] > FPS_WINDOW_MS) {
                frames.shift()
            }

            if (frames.length >= 2) {
                const span = frames[frames.length - 1] - frames[0]
                if (span > 0) {
                    const instant = ((frames.length - 1) * 1000) / span
                    emaFpsRef.current = emaFpsRef.current === 0 ? instant : 0.7 * emaFpsRef.current + 0.3 * instant

                    // 2. Throttle FPS state updates to 1Hz to prevent React render overload
                    if (now - lastFpsUpdateRef.current > 1000) {
                        setFps(Math.round(emaFpsRef.current))
                        lastFpsUpdateRef.current = now
                    }
                }
            }

            setStalled(false)
            if (lostRef.current) notifyLost(false)
        }

        const run = async () => {
            try {
                const res = await fetch(url, { signal: ac.signal })
                if (isCancelled) return
                if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
                connected = true

                const ct = res.headers.get("content-type") || ""
                const bm = /boundary=([^\s;]+)/i.exec(ct)
                const boundary = bm ? bm[1] : "frame"
                const markerStr = "--" + boundary
                const headerEndStr = "\r\n\r\n"

                // String decode ONLY the lightweight boundary metadata, never the full JPEG image
                let textBuffer = ""
                const reader = res.body.getReader()
                const decoder = new TextDecoder("latin1")

                for (;;) {
                    const { value, done } = await reader.read()
                    if (isCancelled) return
                    if (done) break

                    chunks.push(value)
                    totalLen += value.length
                    textBuffer += decoder.decode(value, { stream: true })

                    let markerIdx = textBuffer.indexOf(markerStr)
                    while (markerIdx !== -1) {
                        const hdrEndIdx = textBuffer.indexOf(headerEndStr, markerIdx + markerStr.length)
                        if (hdrEndIdx === -1) break

                        const headerText = textBuffer.slice(markerIdx + markerStr.length, hdrEndIdx)
                        const lenMatch = /Content-Length:\s*(\d+)/i.exec(headerText)
                        if (!lenMatch) break

                        const frameLen = parseInt(lenMatch[1], 10)
                        const frameStartOffset = hdrEndIdx + headerEndStr.length
                        const frameEndOffset = frameStartOffset + frameLen

                        // Check if the entire frame has arrived in the raw stream
                        if (textBuffer.length < frameEndOffset) break

                        // Assemble single Uint8Array for the frame
                        const fullBuffer = new Uint8Array(totalLen)
                        let offset = 0
                        for (let c of chunks) {
                            fullBuffer.set(c, offset)
                            offset += c.length
                        }

                        // Extract pure JPEG bytes
                        const jpegBytes = fullBuffer.subarray(frameStartOffset, frameEndOffset)
                        pushFrame(jpegBytes)

                        // Retain remainder
                        const remainder = fullBuffer.subarray(frameEndOffset)
                        chunks = [remainder]
                        totalLen = remainder.length
                        textBuffer = textBuffer.slice(frameEndOffset)

                        markerIdx = textBuffer.indexOf(markerStr)
                    }
                }
            } catch (err) {
                if (isCancelled) return
                if (err && err.name === "AbortError") return
                if (!connected) notifyLost(true)
            }
        }

        run()

        const id = setInterval(() => {
            if (isCancelled) return
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
            isCancelled = true
            ac.abort()
            clearInterval(id)
            setBlobUrl(prev => {
                if (prev) URL.revokeObjectURL(prev)
                return null
            })
        }
    }, [url, notifyLost])

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