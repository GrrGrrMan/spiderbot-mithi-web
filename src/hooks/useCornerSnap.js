// web-ui/src/hooks/useCornerSnap.js
import { useState, useRef, useEffect, useCallback } from "react"

const DRAG_THRESHOLD = 5

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

    const posRef = useRef(pos)
    posRef.current = pos

    const [isDragging, setIsDragging] = useState(false)
    const isDownRef = useRef(false)
    const hasMovedRef = useRef(false)
    const pointerIdRef = useRef(null)
    const targetPosRef = useRef({ x: 0, y: 0 })

    const dragRef = useRef({
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        bW: 800,
        bH: 600,
        itemW: defaultWidth,
        itemH: defaultHeight,
    })

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

    const getCornerCoords = useCallback(
        (corner, customBounds = null) => {
            const bW = customBounds ? customBounds.bW : getBounds().width
            const bH = customBounds ? customBounds.bH : getBounds().height
            const itemW = customBounds ? customBounds.itemW : (elementRef.current?.offsetWidth || defaultWidth)
            const itemH = customBounds ? customBounds.itemH : (elementRef.current?.offsetHeight || defaultHeight)

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

    const findClosestCorner = useCallback(
        (x, y, customBounds = null) => {
            const bW = customBounds ? customBounds.bW : getBounds().width
            const bH = customBounds ? customBounds.bH : getBounds().height
            const itemW = customBounds ? customBounds.itemW : (elementRef.current?.offsetWidth || defaultWidth)
            const itemH = customBounds ? customBounds.itemH : (elementRef.current?.offsetHeight || defaultHeight)

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
        (currentX, currentY, customBounds = null) => {
            const targetCorner = findClosestCorner(currentX, currentY, customBounds)
            setActiveCorner(targetCorner)
            const coords = getCornerCoords(targetCorner, customBounds)
            setPos(coords)
            if (elementRef.current) {
                elementRef.current.style.left = `${coords.x}px`
                elementRef.current.style.top = `${coords.y}px`
            }
        },
        [findClosestCorner, getCornerCoords]
    )

    const handleRealign = useCallback(() => {
        const coords = getCornerCoords(activeCorner)
        setPos(coords)
        if (elementRef.current) {
            elementRef.current.style.left = `${coords.x}px`
            elementRef.current.style.top = `${coords.y}px`
        }
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

    const handlePointerDown = useCallback((e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return

        isDownRef.current = true
        hasMovedRef.current = false
        pointerIdRef.current = e.pointerId

        const bounds = getBounds()
        const el = elementRef.current

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: posRef.current.x,
            initialY: posRef.current.y,
            bW: bounds.width,
            bH: bounds.height,
            itemW: el ? el.offsetWidth : defaultWidth,
            itemH: el ? el.offsetHeight : defaultHeight,
        }
        targetPosRef.current = { x: posRef.current.x, y: posRef.current.y }

        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch (_) {}
    }, [getBounds, defaultWidth, defaultHeight])

    const handlePointerMove = useCallback((e) => {
        if (!isDownRef.current) return

        const { startX, startY, initialX, initialY } = dragRef.current
        const dx = e.clientX - startX
        const dy = e.clientY - startY

        if (!hasMovedRef.current) {
            if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
                hasMovedRef.current = true
                setIsDragging(true)
            } else {
                return
            }
        }

        const nextX = initialX + dx
        const nextY = initialY + dy
        targetPosRef.current = { x: nextX, y: nextY }

        if (elementRef.current) {
            elementRef.current.style.left = `${nextX}px`
            elementRef.current.style.top = `${nextY}px`
        }
    }, [])

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
            snapToCorner(targetPosRef.current.x, targetPosRef.current.y, dragRef.current)
            setTimeout(() => {
                hasMovedRef.current = false
            }, 50)
        } else {
            setIsDragging(false)
            hasMovedRef.current = false
        }
    }, [snapToCorner])

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