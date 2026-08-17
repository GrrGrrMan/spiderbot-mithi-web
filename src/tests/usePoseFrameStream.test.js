// web-ui/src/tests/usePoseFrameStream.test.js
// Chunk 2 — streams a pose array at <=10Hz through the publish callback and
// stops at the end of the sequence.
import React from "react"
import { render, act } from "@testing-library/react"
import { usePoseFrameStream } from "../hooks/usePoseFrameStream"

const Harness = ({ frames, onPublish, intervalMs }) => {
    usePoseFrameStream(frames, onPublish, { intervalMs })
    return <div data-testid="ok">ok</div>
}

afterEach(() => {
    jest.useRealTimers()
})

describe("usePoseFrameStream", () => {
    test("publishes every frame in order, then stops", () => {
        jest.useFakeTimers()
        const onPublish = jest.fn()
        const frames = [{ a: 1 }, { a: 2 }, { a: 3 }]
        render(<Harness frames={frames} onPublish={onPublish} intervalMs={120} />)
        act(() => {
            jest.advanceTimersByTime(360)
        })
        expect(onPublish).toHaveBeenCalledTimes(3)
        expect(onPublish.mock.calls.map(call => call[0])).toEqual(frames)
        // Stream ended: advancing more must not publish again
        act(() => {
            jest.advanceTimersByTime(1000)
        })
        expect(onPublish).toHaveBeenCalledTimes(3)
    })

    test("empty frames publish nothing", () => {
        jest.useFakeTimers()
        const onPublish = jest.fn()
        render(<Harness frames={[]} onPublish={onPublish} intervalMs={120} />)
        act(() => {
            jest.advanceTimersByTime(1000)
        })
        expect(onPublish).not.toHaveBeenCalled()
    })

    test("new frames restart the stream", () => {
        jest.useFakeTimers()
        const onPublish = jest.fn()
        const { rerender } = render(<Harness frames={[{ a: 1 }]} onPublish={onPublish} intervalMs={120} />)
        act(() => {
            jest.advanceTimersByTime(120)
        })
        expect(onPublish).toHaveBeenCalledTimes(1)
        rerender(<Harness frames={[{ b: 2 }]} onPublish={onPublish} intervalMs={120} />)
        act(() => {
            jest.advanceTimersByTime(120)
        })
        expect(onPublish).toHaveBeenCalledTimes(2)
        expect(onPublish.mock.calls[1][0]).toEqual({ b: 2 })
    })
})