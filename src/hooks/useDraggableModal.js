// web-ui/src/hooks/useDraggableModal.js
import { useState, useRef, useCallback, useEffect } from "react"

const MIN_VISIBLE_X = 60 // Minimum pixels of panel kept visible on screen
const HEADER_HEIGHT = 45
const SNAP_EDGE_THRESHOLD = 24
const PADDING = 10

export const useDraggableModal = (initialX = 20, initialY = 75) => {
    const [position, setPosition] = useState({ x: initialX, y: initialY })
    const posRef = useRef(position)
    posRef.current = position

    const [isDragging, setIsDragging] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const isDownRef = useRef(false)
    const pointerIdRef = useRef(null)
    const cardRef = useRef(null)
    const currentCoordRef = useRef({ x: initialX, y: initialY })

    // Viewport & element bounds cached once per drag to prevent layout thrashing
    const dragRef = useRef({
        startX: 0,
        startY: 0,
        initialX,
        initialY,
        cardW: 440,
        winW: 800,
        winH: 600,
    })

    const calculateMagneticSnap = useCallback((rawX, rawY, bounds = null) => {
        const cardW = bounds ? bounds.cardW : (cardRef.current?.offsetWidth || 440)
        const winW = bounds ? bounds.winW : (document.documentElement.clientWidth || window.innerWidth)
        const winH = bounds ? bounds.winH : (document.documentElement.clientHeight || window.innerHeight)

        let targetX = rawX
        let targetY = rawY

        // 1. Magnetic Edge Attraction (Snaps cleanly to padding if near an edge)
        const rightSnapEdge = winW - cardW - PADDING
        if (Math.abs(targetX - PADDING) < SNAP_EDGE_THRESHOLD) {
            targetX = PADDING
        } else if (Math.abs(targetX - rightSnapEdge) < SNAP_EDGE_THRESHOLD) {
            targetX = rightSnapEdge
        }

        if (Math.abs(targetY - PADDING) < SNAP_EDGE_THRESHOLD) {
            targetY = PADDING
        }

        // 2. Permissive Border Recovery (Guarantees panel is never lost outside screen)
        const minX = -cardW + MIN_VISIBLE_X
        const maxX = winW - MIN_VISIBLE_X
        const minY = PADDING
        const maxY = winH - HEADER_HEIGHT - PADDING

        targetX = Math.max(minX, Math.min(targetX, maxX))
        targetY = Math.max(minY, Math.min(targetY, maxY))

        return { x: targetX, y: targetY }
    }, [])

    // Viewport resize guardian
    useEffect(() => {
        const handleResize = () => {
            const snapped = calculateMagneticSnap(posRef.current.x, posRef.current.y)
            setPosition(snapped)
            if (cardRef.current) {
                cardRef.current.style.left = `${snapped.x}px`
                cardRef.current.style.top = `${snapped.y}px`
            }
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [calculateMagneticSnap])

    const handlePointerDown = useCallback(e => {
        if (e.button !== 0 && e.pointerType === "mouse") return
        if (e.target.closest("button") || e.target.closest("input") || e.target.closest("textarea") || e.target.closest(".no-drag")) {
            return
        }

        isDownRef.current = true
        pointerIdRef.current = e.pointerId

        const card = cardRef.current
        const cardW = card ? card.offsetWidth : 440
        const winW = document.documentElement.clientWidth || window.innerWidth
        const winH = document.documentElement.clientHeight || window.innerHeight

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: posRef.current.x,
            initialY: posRef.current.y,
            cardW,
            winW,
            winH,
        }
        currentCoordRef.current = { x: posRef.current.x, y: posRef.current.y }

        setIsDragging(true)

        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch (_) {}
    }, [])

    const handlePointerMove = useCallback(e => {
        if (!isDownRef.current) return

        const { startX, startY, initialX, initialY } = dragRef.current
        const dx = e.clientX - startX
        const dy = e.clientY - startY

        // ── Permissive Dragging: Full unhindered freedom beyond edges ──
        const nextX = initialX + dx
        const nextY = initialY + dy

        currentCoordRef.current = { x: nextX, y: nextY }

        // Direct-DOM instant update (120 FPS / 0 React render thrashing)
        if (cardRef.current) {
            cardRef.current.style.left = `${nextX}px`
            cardRef.current.style.top = `${nextY}px`
        }
    }, [])

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

        // ── Smooth Magnetic Recovery on Release ──
        const raw = currentCoordRef.current
        const bounds = {
            cardW: dragRef.current.cardW,
            winW: dragRef.current.winW,
            winH: dragRef.current.winH,
        }
        const snapped = calculateMagneticSnap(raw.x, raw.y, bounds)

        setPosition(snapped)

        if (cardRef.current) {
            cardRef.current.style.left = `${snapped.x}px`
            cardRef.current.style.top = `${snapped.y}px`
        }
    }, [calculateMagneticSnap])

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