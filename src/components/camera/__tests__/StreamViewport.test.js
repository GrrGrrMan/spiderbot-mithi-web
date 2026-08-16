// web-ui/src/components/camera/__tests__/StreamViewport.test.js
import React from "react"
import "@testing-library/jest-dom/extend-expect"
import { render, screen, act } from "@testing-library/react"
import StreamViewport from "../StreamViewport"

// New transport: fetch() + a stream of multipart MJPEG frames parsed into
// blob: URLs. jsdom lacks a spec-compliant Blob/stream/URL.createObjectURL, so
// we inject a controllable fake stream (getReader/read) under global.fetch,
// a fake Blob, and stub URL.createObjectURL. The watchdog (1s interval) is
// driven with fake timers + a Date.now stub so stall/lost transitions are
// deterministic.

const latin1Bytes = str => {
    const u = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 0xff
    return u
}

// A frame segment exactly matching the mock/firmware wire format.
const partOf = (bytes) => {
    const content = String.fromCharCode.apply(null, bytes)
    return `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${bytes.length}\r\n\r\n${content}\r\n`
}

// Deterministic, jsdom-safe stream stand-in (getReader().read() resolves on push).
function makeStream() {
    const s = { closed: false, queue: [], pending: null }
    s.getReader = () => ({
        read: () => {
            if (s.closed && !s.queue.length) return Promise.resolve({ value: undefined, done: true })
            if (s.queue.length) return Promise.resolve({ value: s.queue.shift(), done: false })
            return new Promise(res => { s.pending = res })
        },
    })
    s.push = bytes => {
        if (s.pending) {
            const r = s.pending; s.pending = null
            r({ value: bytes, done: false })
        } else s.queue.push(bytes)
    }
    s.close = () => { s.closed = true; if (s.pending) { const r = s.pending; s.pending = null; r({ value: undefined, done: true }) } }
    return s
}

let nowMs = 0
let stream
let fetchMock
let onStatus

beforeEach(() => {
    nowMs = 0
    jest.useFakeTimers()
    jest.spyOn(Date, "now").mockImplementation(() => nowMs)

    const oldURL = global.URL
    global.URL = { createObjectURL: () => "blob:mock-frame", revokeObjectURL: () => {} }
    global.Blob = class { constructor(parts) { this.parts = parts } }
    global._restoreURL = () => { global.URL = oldURL }

    stream = makeStream()
    fetchMock = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => "multipart/x-mixed-replace; boundary=frame" },
            body: stream,
        })
    )
    global.fetch = fetchMock
    onStatus = jest.fn()
})

afterEach(() => {
    if (global._restoreURL) global._restoreURL()
    delete global.fetch
    delete global.Blob
    Date.now.mockRestore()
    jest.useRealTimers()
})

// Pump microtasks inside act so fetch resolution + reader.read continuations
// (which call setState) are wrapped.
const pump = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

// Advance both the fake clock and the Date.now stub in 1s steps so the
// watchdog's 1s interval ticks observe a monotonic real-ish nowMs.
const advance = ms => {
    act(() => {
        const end = nowMs + ms
        while (nowMs < end) {
            const step = Math.min(1000, end - nowMs)
            nowMs += step
            jest.advanceTimersByTime(step)
        }
    })
}

const FRAME = [0xff, 0xd8, 0xff, 0xe0]

describe("StreamViewport (fetch + ReadableStream transport)", () => {
    it("fetches the URL and renders a blob-backed <img> when frames arrive", async () => {
        render(<StreamViewport url="http://cam.local:81/stream" isConnected={true} onStatus={onStatus} />)
        await pump() // fetch resolves, reader.read() becomes pending
        expect(fetchMock).toHaveBeenCalledWith("http://cam.local:81/stream", expect.any(Object))

        act(() => { stream.push(latin1Bytes(partOf(FRAME))) })
        await pump()
        const img = screen.getByTestId("stream-image")
        expect(img).toHaveAttribute("src", "blob:mock-frame")
        expect(onStatus).not.toHaveBeenCalled()
    })

    it("reports lost ({lost:true}) when the stream is unreachable", async () => {
        fetchMock.mockImplementation(() => Promise.reject(new TypeError("fetch failed")))
        render(<StreamViewport url="http://cam.local:81/stream" isConnected={true} onStatus={onStatus} />)
        await pump()
        expect(onStatus).toHaveBeenCalledWith({ lost: true })
        // Component itself renders nothing once lost (parent shows placeholder).
        expect(screen.queryByTestId("stream-image")).not.toBeInTheDocument()
    })

    it("shows a stalled badge when frames stop, and clears it on recovery", async () => {
        render(<StreamViewport url="http://cam.local:81/stream" isConnected={true} onStatus={onStatus} />)
        await pump()
        act(() => { stream.push(latin1Bytes(partOf(FRAME))) })
        await pump()
        expect(screen.getByTestId("stream-image")).toBeInTheDocument()
        expect(screen.queryByTestId("stream-status")).not.toBeInTheDocument()

        // Stop frames → advance past STALL_MS (3s). Watchdog ticks at 1s.
        advance(4000)
        expect(screen.getByTestId("stream-status")).toHaveTextContent(/stalled/i)

        // A fresh frame clears the stall.
        act(() => { stream.push(latin1Bytes(partOf(FRAME))) })
        await pump()
        expect(screen.queryByTestId("stream-status")).not.toBeInTheDocument()
    })

    it("renders nothing and does not fetch when url is null", async () => {
        render(<StreamViewport url={null} isConnected={false} onStatus={onStatus} />)
        await pump()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(screen.queryByTestId("stream-image")).not.toBeInTheDocument()
        expect(onStatus).not.toHaveBeenCalled()
    })
})
