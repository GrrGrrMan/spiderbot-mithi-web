// FILE: src/hooks/useDraggableModal.js
import { useState, useRef, useCallback, useEffect } from "react"

const MIN_VISIBLE_X = 80
const HEADER_HEIGHT = 45
const SNAP_EDGE_THRESHOLD = 16
const PADDING = 10

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
    const rafIdRef = useRef(null) // ◄ rAF Throttle

    const calculateSnapRecovery = useCallback((x, y) => {
        const cardW = cardRef.current?.offsetWidth || 440
        const winW = document.documentElement.clientWidth || window.innerWidth
        const winH = document.documentElement.clientHeight || window.innerHeight

        let snappedY = Math.max(PADDING, y)
        snappedY = Math.min(snappedY, winH - HEADER_HEIGHT - PADDING)

        let snappedX = Math.max(-cardW + MIN_VISIBLE_X, x)
        snappedX = Math.min(snappedX, winW - MIN_VISIBLE_X)

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

    useEffect(() => {
        const handleResize = () => {
            setPosition(prev => calculateSnapRecovery(prev.x, prev.y))
        }
        window.addEventListener("resize", handleResize)
        return () => {
            window.removeEventListener("resize", handleResize)
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
        }
    }, [calculateSnapRecovery])

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

        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch (_) {}
    }, [])

    const handlePointerMove = useCallback(e => {
        if (!isDownRef.current) return

        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY

        const nextX = dragRef.current.initialX + dx
        const nextY = dragRef.current.initialY + dy

        // Batch coordinate updates to match the display refresh rate
        if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null
                setPosition({ x: nextX, y: nextY })
            })
        }
    }, [])

    const handlePointerUp = useCallback(e => {
        if (!isDownRef.current) return
        isDownRef.current = false
        setIsDragging(false)

        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
        }

        if (pointerIdRef.current !== null) {
            try {
                if (e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
                    e.currentTarget.releasePointerCapture(pointerIdRef.current)
                }
            } catch (_) {}
            pointerIdRef.current = null
        }

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