// FILE: src/hooks/useDraggableModal.js
import { useState, useRef, useCallback, useEffect } from "react"

const MIN_VISIBLE_X = 80 // Minimum pixels of window kept on screen horizontally
const HEADER_HEIGHT = 45  // Minimum height of title bar kept visible at the bottom
const SNAP_EDGE_THRESHOLD = 16 // Proximity to screen border for magnetic flush snap
const PADDING = 10        // Standard margin from borders

export const useDraggableModal = (initialX = 20, initialY = 75) => {
    const [position, setPosition] = useState({ x: initialX, y: initialY })
    const posRef = useRef(position)
    posRef.current = position

    const [isDragging, setIsDragging] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const isDownRef = useRef(false)
    const pointerIdRef = useRef(null)
    const dragRef = useRef({ startX: 0, startY: 0, initialX, initialY })
    const cardRef = useRef(null)

    // Calculate safe recovered bounds on release
    const calculateSnapRecovery = useCallback((x, y) => {
        const cardW = cardRef.current?.offsetWidth || 440
        const winW = document.documentElement.clientWidth || window.innerWidth
        const winH = document.documentElement.clientHeight || window.innerHeight

        // 1. Top Header Guard (Header can never disappear above the screen)
        let snappedY = Math.max(PADDING, y)

        // 2. Bottom Sink Guard (Header must remain accessible above bottom edge)
        snappedY = Math.min(snappedY, winH - HEADER_HEIGHT - PADDING)

        // 3. Side Overflow Bounds (Keep at least MIN_VISIBLE_X on screen)
        let snappedX = Math.max(-cardW + MIN_VISIBLE_X, x)
        snappedX = Math.min(snappedX, winW - MIN_VISIBLE_X)

        // 4. Optional Magnetic Edge Snapping (Flush alignment when close to borders)
        if (Math.abs(snappedX - PADDING) < SNAP_EDGE_THRESHOLD) {
            snappedX = PADDING
        } else if (Math.abs(snappedX - (winW - cardW - PADDING)) < SNAP_EDGE_THRESHOLD) {
            snappedX = winW - cardW - PADDING
        }

        if (Math.abs(snappedY - PADDING) < SNAP_EDGE_THRESHOLD) {
            snappedY = PADDING
        }

        return { x: snappedX, y: snappedY }
    }, [])

    // Viewport Resize Guard: Re-evaluate recovery bounds if browser size changes
    useEffect(() => {
        const handleResize = () => {
            setPosition(prev => calculateSnapRecovery(prev.x, prev.y))
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [calculateSnapRecovery])

    // ── 1. Pointer Down ──
    const handlePointerDown = useCallback(e => {
        if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".no-drag")) {
            return
        }

        isDownRef.current = true
        setIsDragging(true)
        pointerIdRef.current = e.pointerId

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: posRef.current.x,
            initialY: posRef.current.y,
        }

        // Capture pointer immediately to guarantee smooth trackpad tracking across borders
        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch (_) {}
    }, [])

    // ── 2. Pointer Move (100% Unrestricted Movement) ──
    const handlePointerMove = useCallback(e => {
        if (!isDownRef.current) return

        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY

        // Free 1:1 cursor tracking without mid-drag resistance
        setPosition({
            x: dragRef.current.initialX + dx,
            y: dragRef.current.initialY + dy,
        })
    }, [])

    // ── 3. Pointer Up (Auto-Recover & Spring Snap) ──
    const handlePointerUp = useCallback(e => {
        if (!isDownRef.current) return
        isDownRef.current = false
        setIsDragging(false)

        if (pointerIdRef.current !== null) {
            try {
                if (e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
                    e.currentTarget.releasePointerCapture(pointerIdRef.current)
                }
            } catch (_) {}
            pointerIdRef.current = null
        }

        // Auto-recover and snap to legal visible bounds
        const recovered = calculateSnapRecovery(posRef.current.x, posRef.current.y)
        setPosition(recovered)
    }, [calculateSnapRecovery])

    const handlePointerCancel = useCallback(e => {
        if (isDownRef.current) {
            handlePointerUp(e)
        }
    }, [handlePointerUp])

    return {
        position,
        isDragging,
        isMinimized,
        setIsMinimized,
        cardRef,    
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
    }
}