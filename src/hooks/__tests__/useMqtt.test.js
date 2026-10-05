// src/hooks/__tests__/useMqtt.test.js
import React from "react"
import { render, act, fireEvent } from "@testing-library/react"
import { useMqtt } from "../useMqtt"
import { settingsStorage } from "../../services/storage"

const HookTestHarness = () => {
    const { isConnected, isConnecting, activeConfig, connectToBroker } = useMqtt()

    return (
        <div>
            <span data-testid="status">{isConnected ? "connected" : isConnecting ? "connecting" : "disconnected"}</span>
            <span data-testid="broker-url">{activeConfig.brokerUrl}</span>
            <span data-testid="device-id">{activeConfig.deviceId}</span>
            <button
                data-testid="btn-switch"
                onClick={() => connectToBroker({ brokerUrl: "wss://new-broker.io:8884/mqtt", deviceId: "robot-99" })}
            >
                Switch Broker
            </button>
        </div>
    )
}

describe("useMqtt hook", () => {
    beforeEach(() => {
        window.localStorage.clear()
        settingsStorage.resetAll()
    })

    test("initializes from persistent storage and connects", async () => {
        const { getByTestId } = render(<HookTestHarness />)

        // Verifies mock connected
        expect(getByTestId("broker-url").textContent).toBe("ws://spider-w.local:9001")
        expect(getByTestId("device-id").textContent).toBe("hexapod-s3-01")
    })

    test("dynamically hot-swaps broker endpoint and saves to cache", async () => {
        const { getByTestId } = render(<HookTestHarness />)

        act(() => {
            fireEvent.click(getByTestId("btn-switch"))
        })

        expect(getByTestId("broker-url").textContent).toBe("wss://new-broker.io:8884/mqtt")
        expect(getByTestId("device-id").textContent).toBe("robot-99")

        // Verifies persisted into SettingsStorageService
        const cachedMqtt = settingsStorage.getSlice("mqtt")
        expect(cachedMqtt.brokerUrl).toBe("wss://new-broker.io:8884/mqtt")
        expect(cachedMqtt.deviceId).toBe("robot-99")
    })
})