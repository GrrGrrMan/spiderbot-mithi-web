// web-ui/src/components/console/ConsoleDrawer.test.js
import React from "react"
import "@testing-library/jest-dom/extend-expect"
import { render, fireEvent, screen } from "@testing-library/react"
import ConsoleDrawer from "./ConsoleDrawer"

const renderDrawer = (overrides = {}) => {
    const props = {
        isConnected: true,
        logs: [],
        publishImmediate: jest.fn(),
        clearLogs: jest.fn(),
        telemetry: null,
        ...overrides,
    }
    return render(<ConsoleDrawer {...props} />)
}

describe("ConsoleDrawer", () => {
    it("renders the console title and command entry", () => {
        renderDrawer()
        expect(screen.getByText("CONSOLE & SYSTEM COMMANDS")).toBeInTheDocument()
        expect(screen.getByLabelText("Command Entry:")).toBeInTheDocument()
    })

    it("sends a parsed JSON command to hexapod/cmd", () => {
        const publishImmediate = jest.fn()
        renderDrawer({ publishImmediate })

        fireEvent.change(screen.getByLabelText("Command Entry:"), {
            target: { value: '{"type":"system","logging":true}' },
        })
        fireEvent.click(screen.getByText("Send"))

        expect(publishImmediate).toHaveBeenCalledWith("hexapod/cmd", {
            type: "system",
            logging: true,
        })
        expect(screen.getByLabelText("Command Entry:")).toHaveValue("")
    })

    it("alerts on invalid JSON and does not publish", () => {
        const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {})
        const publishImmediate = jest.fn()
        renderDrawer({ publishImmediate })

        fireEvent.change(screen.getByLabelText("Command Entry:"), {
            target: { value: "not json" },
        })
        fireEvent.click(screen.getByText("Send"))

        expect(alertSpy).toHaveBeenCalledWith("Invalid JSON format!")
        expect(publishImmediate).not.toHaveBeenCalled()
        alertSpy.mockRestore()
    })

    it("publishes system macros with the expected payloads", () => {
        const publishImmediate = jest.fn()
        renderDrawer({ publishImmediate })

        fireEvent.click(screen.getByText("Enable Logs"))
        expect(publishImmediate).toHaveBeenLastCalledWith("hexapod/cmd", {
            type: "system",
            logging: true,
        })

        fireEvent.click(screen.getByText("Disable Logs"))
        expect(publishImmediate).toHaveBeenLastCalledWith("hexapod/cmd", {
            type: "system",
            logging: false,
        })

        fireEvent.click(screen.getByText("Reboot ESP32"))
        expect(publishImmediate).toHaveBeenLastCalledWith("hexapod/cmd", {
            type: "system",
            command: "reboot",
        })

        fireEvent.click(screen.getByText("Trigger OTA"))
        expect(publishImmediate).toHaveBeenLastCalledWith("hexapod/cmd", {
            type: "ota",
            primary: true,
        })
    })

    it("defaults to awake and toggles power via a system command", () => {
        const publishImmediate = jest.fn()
        renderDrawer({ publishImmediate })

        // localIsAwake defaults to true -> shows "Relax (Limp)"
        expect(screen.getByText("Relax (Limp)")).toBeInTheDocument()

        fireEvent.click(screen.getByText("Relax (Limp)"))
        expect(publishImmediate).toHaveBeenCalledWith("hexapod/cmd", {
            type: "system",
            power: false,
        })
        expect(screen.getByText("Wake (Torque)")).toBeInTheDocument()
    })

    it("prefers telemetry power state over the local fallback", () => {
        renderDrawer({ telemetry: { power: false } })
        expect(screen.getByText("Wake (Torque)")).toBeInTheDocument()
        expect(screen.queryByText("Relax (Limp)")).not.toBeInTheDocument()
    })

    it("renders remote logs and clears them on request", () => {
        const clearLogs = jest.fn()
        renderDrawer({ logs: ["line one", "line two"], clearLogs })

        expect(screen.getByText("line one")).toBeInTheDocument()
        expect(screen.getByText("line two")).toBeInTheDocument()

        fireEvent.click(screen.getByText("Clear Terminal"))
        expect(clearLogs).toHaveBeenCalled()
    })

    it("expands and collapses the console body", () => {
        renderDrawer()
        expect(screen.getByText("Command Entry:")).toBeInTheDocument()

        fireEvent.click(screen.getByText("Collapse ▲"))
        expect(screen.queryByText("Command Entry:")).not.toBeInTheDocument()

        fireEvent.click(screen.getByText("Expand ▼"))
        expect(screen.getByText("Command Entry:")).toBeInTheDocument()
    })
})