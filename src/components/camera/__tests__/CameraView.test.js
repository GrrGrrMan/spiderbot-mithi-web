// web-ui/src/components/camera/__tests__/CameraView.test.js
import React from "react"
import "@testing-library/jest-dom/extend-expect"
import { render, screen } from "@testing-library/react"
import CameraView, { resolveMjpegUrl } from "../CameraView"

// Stub the children so we don't pull in the StreamViewport's setInterval
// watchdog (which would leave open handles in jsdom). We test
// StreamViewport's stall logic via a dedicated file later if needed.
jest.mock("../StreamViewport", () => ({
    __esModule: true,
    default: ({ url }) => (
        <div data-testid="stream-viewport-stub" data-url={url} />
    ),
}))
jest.mock("../OfflinePlaceholder", () => ({
    __esModule: true,
    default: ({ reason }) => (
        <div data-testid="camera-offline-placeholder">{reason || "Camera not available"}</div>
    ),
}))

// A small helper so each test can pass an explicit URLSearchParams — the
// component reads from window.location by default which is brittle in jest.
const makeParams = query =>
    query ? new URLSearchParams(query) : new URLSearchParams()

describe("resolveMjpegUrl (precedence rule)", () => {
    it("prefers ?mjpeg=<url> over everything else", () => {
        const params = makeParams("mjpeg=http://override.local:9000/stream")
        expect(
            resolveMjpegUrl(
                { mjpeg_url: "http://config.local/stream" },
                { ip: "10.0.0.5" },
                params
            )
        ).toBe("http://override.local:9000/stream")
    })

    it("falls back to config.mjpeg_url when no override is set", () => {
        const params = makeParams("")
        expect(
            resolveMjpegUrl(
                { mjpeg_url: "http://192.168.4.1:81/stream" },
                { ip: "10.0.0.5" },
                params
            )
        ).toBe("http://192.168.4.1:81/stream")
    })

    it("falls back to http://<telemetry.ip>:81/stream when no config", () => {
        const params = makeParams("")
        expect(
            resolveMjpegUrl(null, { ip: "192.168.4.42" }, params)
        ).toBe("http://192.168.4.42:81/stream")
    })

    it("returns null when nothing resolves", () => {
        const params = makeParams("")
        expect(resolveMjpegUrl(null, null, params)).toBeNull()
        expect(resolveMjpegUrl({}, {}, params)).toBeNull()
    })

    it("ignores invalid telemetry (0.0.0.0) and empty config strings", () => {
        const params = makeParams("")
        expect(
            resolveMjpegUrl(
                { mjpeg_url: "" },
                { ip: "0.0.0.0" },
                params
            )
        ).toBeNull()
    })
})

describe("CameraView", () => {
    it("renders OfflinePlaceholder when no URL is resolvable", () => {
        render(
            <CameraView
                config={null}
                telemetry={null}
                isConnected={false}
            />
        )
        expect(
            screen.getByTestId("camera-offline-placeholder")
        ).toBeInTheDocument()
        expect(screen.getByText(/waiting for mqtt/i)).toBeInTheDocument()
    })

    it("renders OfflinePlaceholder with the post-connection reason when isConnected but still no URL", () => {
        render(
            <CameraView
                config={null}
                telemetry={null}
                isConnected={true}
            />
        )
        expect(
            screen.getByTestId("camera-offline-placeholder")
        ).toBeInTheDocument()
        expect(
            screen.getByText(/camera not yet announced/i)
        ).toBeInTheDocument()
    })

    it("renders StreamViewport when config.mjpeg_url is available", () => {
        render(
            <CameraView
                config={{ mjpeg_url: "http://192.168.4.1:81/stream" }}
                telemetry={null}
                isConnected={true}
            />
        )
        const stub = screen.getByTestId("stream-viewport-stub")
        expect(stub).toBeInTheDocument()
        expect(stub).toHaveAttribute(
            "data-url",
            "http://192.168.4.1:81/stream"
        )
    })

    it("renders StreamViewport when only telemetry.ip is available", () => {
        render(
            <CameraView
                config={null}
                telemetry={{ ip: "10.0.0.99" }}
                isConnected={true}
            />
        )
        const stub = screen.getByTestId("stream-viewport-stub")
        expect(stub).toHaveAttribute("data-url", "http://10.0.0.99:81/stream")
    })

    it("carries the camera-view testid so App-level tests can find it", () => {
        render(
            <CameraView
                config={{ mjpeg_url: "http://x:81/stream" }}
                telemetry={null}
                isConnected={true}
            />
        )
        expect(screen.getByTestId("camera-view")).toBeInTheDocument()
    })
})
