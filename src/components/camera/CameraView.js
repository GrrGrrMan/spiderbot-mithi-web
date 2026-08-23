// web-ui/src/components/camera/CameraView.js
import React, { useMemo, useRef, useState, useEffect } from "react"
import StreamViewport from "./StreamViewport"
import OfflinePlaceholder from "./OfflinePlaceholder"

const CAM_STREAM_PORT = 81

export const resolveMjpegUrl = (config, telemetry, searchParams) => {
    const qOverride = searchParams?.get("mjpeg")
    if (qOverride) return qOverride

    // 1. If served from the Pi (Nginx reverse proxy), use the relative endpoint
    if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
        return `${window.location.protocol}//${window.location.host}/cam-stream`
    }

    // 2. Direct firmware config broadcast
    if (config && typeof config.mjpeg_url === "string" && config.mjpeg_url) {
        return config.mjpeg_url
    }

    // 3. Fallback to direct telemetry IP
    if (telemetry && telemetry.ip && telemetry.ip !== "0.0.0.0") {
        return `http://${telemetry.ip}:81/stream`
    }

    return null
}

const reasonFor = (url, isConnected, lost) => {
    if (lost) return "Stream lost — reconnecting…"
    if (url) return null
    if (!isConnected) return "Waiting for MQTT…"
    return "Camera not yet announced (no mjpeg_url in config)"
}

const CameraView = ({ config, telemetry, isConnected }) => {
    const searchParamsRef = useRef(null)
    if (searchParamsRef.current === null && typeof window !== "undefined") {
        searchParamsRef.current = new URLSearchParams(window.location.search)
    }
    const searchParams = searchParamsRef.current

    const url = useMemo(
        () => resolveMjpegUrl(config, telemetry, searchParams),
        [config, telemetry]
    )

    const [lost, setLost] = useState(false)
    const [retryKey, setRetryKey] = useState(0)

    useEffect(() => {
        setLost(false)
    }, [url])

    // Auto-retry connection every 3 seconds if lost
    useEffect(() => {
        if (!lost) return
        const timer = setTimeout(() => {
            setLost(false)
            setRetryKey(k => k + 1)
        }, 3000)
        return () => clearTimeout(timer)
    }, [lost])

    const effectiveUrl = url
    const showPlaceholder = !effectiveUrl || lost

    const wrapperStyle = {
        position: "absolute",
        inset: 0,
    }

    return (
        <div style={wrapperStyle} data-testid="camera-view">
            {showPlaceholder ? (
                <OfflinePlaceholder reason={reasonFor(effectiveUrl, isConnected, lost)} />
            ) : (
                <StreamViewport
                    key={retryKey}
                    url={effectiveUrl}
                    isConnected={isConnected}
                    onStatus={({ lost: isLost }) => setLost(isLost)}
                />
            )}
        </div>
    )
}

export default CameraView