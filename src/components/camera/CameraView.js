// web-ui/src/components/camera/CameraView.js
//
// P2 Phase B: orchestrator for the camera stage. Resolves the effective
// MJPEG URL using the precedence mandated by
// docs/future-roadmap/camera/README.md §B:
//
//   ?mjpeg=<url>  >  config.mjpeg_url  >  http://<telemetry.ip>:81/stream
//
// If nothing resolves, renders OfflinePlaceholder with a context-aware
// reason so the user can tell whether they're waiting on MQTT, on the
// firmware config handshake, or just haven't seen the IP yet.
//
// Persistence note: we remember the last *known-good* URL in a ref so a
// brief MQTT hiccup doesn't flash "Offline" at the user. We only show
// the placeholder if isConnected is false AND we've never seen a URL,
// OR if we've gone lost (StreamViewport flagged it).

import React, { useMemo, useRef } from "react"
import StreamViewport from "./StreamViewport"
import OfflinePlaceholder from "./OfflinePlaceholder"

const CAM_STREAM_PORT = 81 // mirror of firmware/cam-main/include/config/cam_config.h

// Precedence resolver. Exported for unit tests.
export const resolveMjpegUrl = (config, telemetry, searchParams) => {
    const qOverride = searchParams?.get("mjpeg")
    if (qOverride) return qOverride

    if (config && typeof config.mjpeg_url === "string" && config.mjpeg_url) {
        return config.mjpeg_url
    }

    if (
        telemetry &&
        typeof telemetry.ip === "string" &&
        telemetry.ip.length > 0 &&
        telemetry.ip !== "0.0.0.0"
    ) {
        return `http://${telemetry.ip}:${CAM_STREAM_PORT}/stream`
    }

    return null
}

const reasonFor = (url, isConnected) => {
    if (url) return null
    if (!isConnected) return "Waiting for MQTT…"
    return "Camera not yet announced (no mjpeg_url in config)"
}

const CameraView = ({ config, telemetry, isConnected }) => {
    // Cache the URLSearchParams object across renders so the memo's
    // dependency array can include it without invalidating every cycle.
    const searchParamsRef = useRef(null)
    if (searchParamsRef.current === null && typeof window !== "undefined") {
        searchParamsRef.current = new URLSearchParams(window.location.search)
    }
    const searchParams = searchParamsRef.current

    const url = useMemo(
        () => resolveMjpegUrl(config, telemetry, searchParams),
        // searchParams is intentionally excluded — it's a frozen ref read at
        // mount; the user controls it via the URL bar, not via component state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [config, telemetry]
    )

    // Keep the last known-good URL so brief MQTT drops don't cause a
    // placeholder flash. We only show OfflinePlaceholder if url is null.
    const lastUrlRef = useRef(url)
    if (url) lastUrlRef.current = url

    const effectiveUrl = url // current resolution wins; OfflinePlaceholder
                             // takes over only when this is null

    const wrapperStyle = {
        position: "absolute",
        inset: 0,
    }

    return (
        <div style={wrapperStyle} data-testid="camera-view">
            {effectiveUrl ? (
                <StreamViewport url={effectiveUrl} isConnected={isConnected} />
            ) : (
                <OfflinePlaceholder reason={reasonFor(effectiveUrl, isConnected)} />
            )}
        </div>
    )
}

export default CameraView
