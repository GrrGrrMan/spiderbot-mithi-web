// web-ui/src/components/camera/StreamViewport.js
import React, { useState, useEffect, useRef, useCallback } from "react"
import StreamStatusBar from "./StreamStatusBar"

export const StreamViewport = ({ url, isConnected, onStatus }) => {
    const [stalled, setStalled] = useState(false)
    const [streamKey, setStreamKey] = useState(0)
    const onStatusRef = useRef(onStatus)
    onStatusRef.current = onStatus

    const notifyLost = useCallback(lost => {
        if (onStatusRef.current) onStatusRef.current({ lost })
    }, [])

    // Handle stream load errors with automatic 3s recovery
    const handleError = () => {
        setStalled(true)
        notifyLost(true)
        setTimeout(() => {
            setStreamKey(k => k + 1)
        }, 3000)
    }

    const handleLoad = () => {
        setStalled(false)
        notifyLost(false)
    }

    useEffect(() => {
        setStalled(false)
    }, [url])

    if (!url) return null

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
                key={`${url}-${streamKey}`}
                src={url}
                alt="Hexapod Camera Stream"
                style={imgStyle}
                data-testid="stream-image"
                onLoad={handleLoad}
                onError={handleError}
            />
            <StreamStatusBar
                resolutionHint={isConnected ? "VGA · Direct Relay" : null}
                status={stalled ? "Reconnecting stream…" : null}
            />
        </div>
    )
}

export default StreamViewport