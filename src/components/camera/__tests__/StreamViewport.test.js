// web-ui/src/components/camera/__tests__/StreamViewport.test.js
import React from "react"
import "@testing-library/jest-dom/extend-expect"
import { render, screen, act } from "@testing-library/react"
import StreamViewport from "../StreamViewport"

// StreamViewport owns two setInterval timers (3s stall watchdog, 2s FPS
// sampler). We use fake timers + manual advancement so jsdom never leaves
// open handles and so we can deterministically drive time forward to
// observe the "stalled → remount" and "lost → unmount" transitions.
//
// IMPORTANT: this jest version (react-scripts 3.4.4 → jest 24) fakes
// setTimeout/setInterval but NOT Date.now. The watchdog and FPS sampler
// timestamp with Date.now(), so we stub it too and advance our own `nowMs`
// in lockstep with the fake timers, in ≤3000ms substeps so interval
// callbacks observe a realistically increasing time (not a single giant
// jump — the watchdog's grace-period math depends on tick spacing).

let nowMs = 0

beforeEach(() => {
    nowMs = 0
    jest.useFakeTimers()
    jest.spyOn(Date, "now").mockImplementation(() => nowMs)
})

afterEach(() => {
    Date.now.mockRestore()
    jest.useRealTimers()
})

// Advance BOTH the fake clock and the Date.now stub in ≤3000ms steps so
// each watchdog tick fires at the time the watchdog would actually see.
const advance = ms => {
    act(() => {
        const end = nowMs + ms
        while (nowMs < end) {
            const step = Math.min(3000, end - nowMs)
            nowMs += step
            jest.advanceTimersByTime(step)
        }
    })
}

describe("StreamViewport", () => {

    it("renders an <img> with the cache-busted source URL", () => {
        render(
            <StreamViewport url="http://cam.local:81/stream" isConnected={true} />
        )
        const img = screen.getByTestId("stream-image")
        expect(img.tagName).toBe("IMG")
        // Cache-bust query param must be present (defeats HTTP cache).
        expect(img.getAttribute("src")).toMatch(
            /^http:\/\/cam\.local:81\/stream\?t=\d+$/
        )
    })

    it("flips to stalled after STALL_MS with no onLoad activity", () => {
        render(
            <StreamViewport url="http://cam.local:81/stream" isConnected={true} />
        )
        // No onLoad fires — advance past the 3 s stall threshold. The FIRST
        // watchdog tick (at +3000ms) is the grace period (gap == STALL_MS,
        // not >), so advance past +6000ms where the tick sees a 6000ms gap.
        advance(6500)
        expect(screen.getByTestId("stream-status")).toHaveTextContent(
            /stalled/i
        )
    })

    it("clears the stalled status when an onLoad arrives", () => {
        render(
            <StreamViewport url="http://cam.local:81/stream" isConnected={true} />
        )
        // First, go stalled (watchdog tick at +6000ms sees a 6000ms gap).
        advance(6500)
        expect(screen.getByTestId("stream-status")).toHaveTextContent(/stalled/i)

        // Fire an onLoad — should clear the stalled flag.
        act(() => {
            screen.getByTestId("stream-image").dispatchEvent(new Event("load"))
        })

        // Next watchdog tick (at +9000ms) sees a fresh frame (gap 2500ms) →
        // stalled stays cleared and the status badge disappears.
        advance(3000)
        expect(screen.queryByTestId("stream-status")).not.toBeInTheDocument()
    })

    it("remounts the <img> (bumps its key) when stalled beyond cooldown", () => {
        render(
            <StreamViewport url="http://cam.local:81/stream" isConnected={true} />
        )
        const before = screen.getByTestId("stream-image")

        // +3000ms tick = grace (gap == STALL_MS, not >). The +6000ms tick
        // sees a 6000ms gap → stalled AND past the 5000ms remount cooldown
        // (lastRemountRef starts at 0) → the <img> gets a fresh key + new
        // cache-bust. Stop before +9000ms where "lost" would fire (jsdom
        // never delivers an onLoad for the remounted img).
        advance(6500)

        const after = screen.getByTestId("stream-image")
        expect(after).not.toBe(before)
        // The src's cache-bust changed — fresh connection attempt.
        expect(after.getAttribute("src")).not.toBe(before.getAttribute("src"))
    })

    it("renders nothing once lost (parent takes over with OfflinePlaceholder)", () => {
        render(
            <StreamViewport url="http://cam.local:81/stream" isConnected={true} />
        )
        // Tick +3000ms: grace period (gap == STALL_MS, not >) — no stall.
        // Tick +6000ms: gap 6000ms > STALL_MS → stalled + remount (cooldown
        //   met against lastRemountRef=0).
        // Tick +9000ms: gap 9000ms > STALL_MS + REMOUNT_COOLDOWN_MS (8000ms)
        //   while inside the remount cooldown → LOST.
        advance(6000)
        advance(3000)
        // After "lost", StreamViewport returns null — no img, no viewport.
        expect(screen.queryByTestId("stream-image")).not.toBeInTheDocument()
        expect(screen.queryByTestId("stream-viewport")).not.toBeInTheDocument()
    })

    it("does nothing when url is null (parent decides what to show)", () => {
        render(<StreamViewport url={null} isConnected={false} />)
        // No watchdog starts without a url — no timer side-effects, no img.
        advance(10000)
        expect(screen.queryByTestId("stream-image")).not.toBeInTheDocument()
    })
})
