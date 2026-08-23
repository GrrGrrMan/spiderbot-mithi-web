// web-ui/src/components/camera/CameraView.js
import React, { useMemo, useRef, useState, useEffect } from "react"
import StreamViewport from "./StreamViewport"
import OfflinePlaceholder from "./OfflinePlaceholder"
import { resolveCameraStreamUrl } from "../../utils/networkConfig"

export const resolveMjpegUrl = resolveCameraStreamUrl

const reasonFor = (url, isConnected, lost) => {
    if (lost) return "Stream lost — reconnecting to relay…"
    if (url) return null
    if (!isConnected) return "Waiting for MQTT connection to Pi…"
    return "Camera stream not yet available"
}

const CameraView = ({ config, telemetry, isConnected }) => {
    const searchParamsRef = useRef(null)
    if (searchParamsRef.current === null && typeof window !== "undefined") {
        searchParamsRef.current = new URLSearchParams(window.location.search)
    }

    const url = useMemo(
        () => resolveCameraStreamUrl(config, telemetry, searchParamsRef.current),
        [config, telemetry]
    )

    const [lost, setLost] = useState(false)
    const [retryKey, setRetryKey] = useState(0)

    useEffect(() => {
        setLost(false)
    }, [url])

    useEffect(() => {
        if (!lost) return
        const timer = setTimeout(() => {
            setLost(false)
            setRetryKey(k => k + 1)
        }, 3000)
        return () => clearTimeout(timer)
    }, [lost])

    const showPlaceholder = !url || lost

    return (
        <div style={{ position: "absolute", inset: 0 }} data-testid="camera-view">
            {showPlaceholder ? (
                <OfflinePlaceholder reason={reasonFor(url, isConnected, lost)} />
            ) : (
                <StreamViewport
                    key={retryKey}
                    url={url}
                    isConnected={isConnected}
                    onStatus={({ lost: isLost }) => setLost(isLost)}
                />
            )}
        </div>
    )
}

export default CameraView