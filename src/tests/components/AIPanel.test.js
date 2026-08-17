import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import AIPanel from "../../components/pages/AIPanel"

beforeEach(() => {
    // AIPanel reads its initial messages from sessionStorage; the previous
    // test's push() would otherwise leak into the next test's render.
    window.sessionStorage.clear()
})

const makeProps = overrides => ({
    publishImmediate: jest.fn(),
    publishAi: jest.fn(),
    publishAudio: jest.fn(),
    isConnected: true,
    aiStatus: null,
    audioStatus: null,
    aiMessages: [],
    onMount: jest.fn(),
    // Chunk 2 — preset gestures stream {type:"pose"} frames from the local
    // interpolator; AIPanel falls back to defaults when params are missing.
    params: {},
    ...overrides,
})

const typeAndSend = (text) => {
    fireEvent.change(screen.getByLabelText("AI input"), { target: { value: text } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
}

describe("AIPanel", () => {
    test("renders the panel heading and all action card buttons", () => {
        render(<AIPanel {...makeProps()} />)
        expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Walk Forward" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Spin Around" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Beep" })).toBeInTheDocument()
    })

    test("clicking an action card publishes the canonical payload", () => {
        const publishImmediate = jest.fn()
        render(<AIPanel {...makeProps({ publishImmediate })} />)
        fireEvent.click(screen.getByRole("button", { name: "Walk Forward" }))
        expect(publishImmediate).toHaveBeenCalledWith(
            "hexapod/cmd",
            expect.objectContaining({ type: "motion", vx: 40, omega: 0 })
        )
        // canned reply echoes into the chat
        expect(screen.getByText(/On it — moving forward/)).toBeInTheDocument()
    })

    test("audio actions route through publishAudio, not cmd", () => {
        const publishAudio = jest.fn()
        const publishImmediate = jest.fn()
        render(<AIPanel {...makeProps({ publishAudio, publishImmediate })} />)
        fireEvent.click(screen.getByRole("button", { name: "Beep" }))
        expect(publishAudio).toHaveBeenCalledWith({ action: "beep" })
        expect(publishImmediate).not.toHaveBeenCalled()
    })

    test("offline text send maps keyword -> action + canned reply", () => {
        const publishImmediate = jest.fn()
        const publishAi = jest.fn()
        render(<AIPanel {...makeProps({ publishImmediate, publishAi, aiStatus: null })} />)
        typeAndSend("please walk forward")
        expect(publishImmediate).toHaveBeenCalledWith(
            "hexapod/cmd",
            expect.objectContaining({ type: "motion", vx: 40 })
        )
        expect(publishAi).not.toHaveBeenCalled()
        expect(screen.getByText("please walk forward")).toBeInTheDocument()
        expect(screen.getByText(/On it — moving forward/)).toBeInTheDocument()
    })

    test("offline text without a keyword falls back to canned reply only", () => {
        const publishImmediate = jest.fn()
        render(<AIPanel {...makeProps({ publishImmediate, aiStatus: null })} />)
        typeAndSend("tell me a joke")
        expect(publishImmediate).not.toHaveBeenCalled()
        expect(screen.getByText(/offline mode/)).toBeInTheDocument()
    })

    test("online text routes to the AI service, not direct cmd", () => {
        const publishAi = jest.fn()
        const publishImmediate = jest.fn()
        render(
            <AIPanel
                {...makeProps({
                    publishAi,
                    publishImmediate,
                    aiStatus: { state: "online", llm: { provider: "groq", model: "llama-3.3-70b-versatile" } },
                })}
            />
        )
        typeAndSend("hello robot")
        expect(publishAi).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "text",
                role: "user",
                content: "hello robot",
                history: expect.any(Array),
            })
        )
        expect(publishImmediate).not.toHaveBeenCalled()
    })

    test("health indicator reflects online state", () => {
        render(<AIPanel {...makeProps({ aiStatus: { state: "online", llm: { provider: "groq", model: "x" } } })} />)
        expect(screen.getByText("AI online")).toBeInTheDocument()
        expect(screen.getByText(/groq:x/)).toBeInTheDocument()
    })

    // Chunk 2 — preset actions are web-ui-executed (the firmware has no preset
    // handler): clicking the card runs the local interpolator and streams
    // {type:"pose"} frames instead of publishing the raw preset payload.
    test("preset actions run the local interpolator, not raw MQTT", () => {
        jest.useFakeTimers()
        const publishImmediate = jest.fn()
        render(<AIPanel {...makeProps({ publishImmediate })} />)
        fireEvent.click(screen.getByRole("button", { name: "Wave" }))
        // The raw {type:"preset"} payload never hits MQTT
        expect(publishImmediate).not.toHaveBeenCalled()
        // Canned reply still echoes into the chat
        expect(screen.getByText("Hello there — wave!")).toBeInTheDocument()
        // The local interpolator streams {type:"pose"} frames instead
        act(() => {
            jest.advanceTimersByTime(600)
        })
        expect(publishImmediate).toHaveBeenCalledWith(
            "hexapod/cmd",
            expect.objectContaining({ type: "pose", pose: expect.anything() })
        )
        jest.useRealTimers()
    })

    test("assistant reply with action_id triggers the local preset", () => {
        jest.useFakeTimers()
        const publishImmediate = jest.fn()
        const { rerender } = render(<AIPanel {...makeProps({ publishImmediate, aiMessages: [] })} />)
        rerender(
            <AIPanel
                {...makeProps({
                    publishImmediate,
                    aiMessages: [
                        { role: "assistant", type: "text", content: "Hello there — wave!", action_id: "preset_wave" },
                    ],
                })}
            />
        )
        act(() => {
            jest.advanceTimersByTime(600)
        })
        expect(publishImmediate).toHaveBeenCalledWith(
            "hexapod/cmd",
            expect.objectContaining({ type: "pose", pose: expect.anything() })
        )
        jest.useRealTimers()
    })
})