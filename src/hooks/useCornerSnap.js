// FILE: src/hooks/useCornerSnap.js
import { useState, useRef, useEffect, useCallback } from "react"

const DRAG_THRESHOLD = 5 // Minimum pixels moved to switch from click to drag

export const useCornerSnap = ({
    boundary = "window",
    defaultCorner = "bottom-right",
    marginX = 15,
    marginY = 15,
    defaultWidth = 140,
    defaultHeight = 40,
} = {}) => {
    const elementRef = useRef(null)
    const [activeCorner, setActiveCorner] = useState(defaultCorner)
    const [pos, setPos] = useState({ x: 0, y: 0 })
    
    // Live reference prevents stale state closures during fast trackpad gestures
    const posRef = useRef(pos)
    posRef.current = pos

    const [isDragging, setIsDragging] = useState(false)
    const isDownRef = useRef(false)
    const hasMovedRef = useRef(false)
    const pointerIdRef = useRef(null)
    const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 })

    // Boundary resolver
    const getBounds = useCallback(() => {
        if (boundary === "parent" && elementRef.current) {
            const parent = elementRef.current.offsetParent || elementRef.current.parentElement
            if (parent) {
                return {
                    width: parent.clientWidth || 600,
                    height: parent.clientHeight || 600,
                }
            }
        }
        return {
            width: document.documentElement.clientWidth || window.innerWidth || 800,
            height: document.documentElement.clientHeight || window.innerHeight || 600,
        }
    }, [boundary])

    // Corner coordinate generator
    const getCornerCoords = useCallback(
        (corner) => {
            const { width: bW, height: bH } = getBounds()
            const itemW = elementRef.current?.offsetWidth || defaultWidth
            const itemH = elementRef.current?.offsetHeight || defaultHeight

            const leftX = marginX
            const rightX = Math.max(marginX, bW - itemW - marginX)
            const topY = marginY
            const bottomY = Math.max(marginY, bH - itemH - marginY)

            switch (corner) {
                case "top-left":
                    return { x: leftX, y: topY }
                case "top-right":
                    return { x: rightX, y: topY }
                case "bottom-left":
                    return { x: leftX, y: bottomY }
                case "bottom-right":
                default:
                    return { x: rightX, y: bottomY }
            }
        },
        [getBounds, marginX, marginY, defaultWidth, defaultHeight]
    )

    // Closest corner resolver
    const findClosestCorner = useCallback(
        (x, y) => {
            const { width: bW, height: bH } = getBounds()
            const itemW = elementRef.current?.offsetWidth || defaultWidth
            const itemH = elementRef.current?.offsetHeight || defaultHeight

            const centerX = x + itemW / 2
            const centerY = y + itemH / 2

            const isRight = centerX > bW / 2
            const isBottom = centerY > bH / 2

            if (isRight && isBottom) return "bottom-right"
            if (!isRight && isBottom) return "bottom-left"
            if (isRight && !isBottom) return "top-right"
            return "top-left"
        },
        [getBounds, defaultWidth, defaultHeight]
    )

    const snapToCorner = useCallback(
        (currentX, currentY) => {
            const targetCorner = findClosestCorner(currentX, currentY)
            setActiveCorner(targetCorner)
            setPos(getCornerCoords(targetCorner))
        },
        [findClosestCorner, getCornerCoords]
    )

    const handleRealign = useCallback(() => {
        setPos(getCornerCoords(activeCorner))
    }, [activeCorner, getCornerCoords])

    useEffect(() => {
        handleRealign()

        let ro = null
        if (boundary === "parent" && elementRef.current) {
            const parent = elementRef.current.offsetParent || elementRef.current.parentElement
            if (parent && typeof ResizeObserver !== "undefined") {
                ro = new ResizeObserver(() => handleRealign())
                ro.observe(parent)
            }
        }

        window.addEventListener("resize", handleRealign)
        return () => {
            if (ro) ro.disconnect()
            window.removeEventListener("resize", handleRealign)
        }
    }, [boundary, handleRealign])

    // ── 1. Pointer Down (Synchronously Capture Pointer) ──
    const handlePointerDown = useCallback((e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return

        isDownRef.current = true
        hasMovedRef.current = false
        pointerIdRef.current = e.pointerId

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: posRef.current.x,
            initialY: posRef.current.y,
        }

        // Must capture on pointerdown so fast trackpad movement never escapes the element
        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch (_) {}
    }, [])

    // ── 2. Pointer Move (Threshold Gated) ──
    const handlePointerMove = useCallback((e) => {
        if (!isDownRef.current) return

        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY

        if (!hasMovedRef.current) {
            if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
                hasMovedRef.current = true
                setIsDragging(true)
            } else {
                return
            }
        }

        // Update position freely without boundary lock while dragging
        setPos({
            x: dragRef.current.initialX + dx,
            y: dragRef.current.initialY + dy,
        })
    }, [])

    // ── 3. Pointer Up (Release & Snap) ──
    const handlePointerUp = useCallback((e) => {
        if (!isDownRef.current) return
        isDownRef.current = false

        if (pointerIdRef.current !== null) {
            try {
                if (e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
                    e.currentTarget.releasePointerCapture(pointerIdRef.current)
                }
            } catch (_) {}
            pointerIdRef.current = null
        }

        if (hasMovedRef.current) {
            setIsDragging(false)
            snapToCorner(posRef.current.x, posRef.current.y)

            // Block any trailing synthetic click event from firing after a drag
            setTimeout(() => {
                hasMovedRef.current = false
            }, 50)
        } else {
            setIsDragging(false)
            hasMovedRef.current = false
        }
    }, [snapToCorner])

    // ── 4. Cancel Guard ──
    const handlePointerCancel = useCallback((e) => {
        if (isDownRef.current) {
            handlePointerUp(e)
        }
    }, [handlePointerUp])

    return {
        elementRef,
        pos,
        isDragging,
        hasMovedRef,
        activeCorner,
        setActiveCorner,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
    }
}