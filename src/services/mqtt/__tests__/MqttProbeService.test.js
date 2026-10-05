// src/services/mqtt/__tests__/MqttProbeService.test.js
import { mqttProbe } from "../MqttProbeService"
import { PROBE_STAGES, PROBE_STATUS } from "../probeStages"

describe("MqttProbeService", () => {
    afterEach(() => {
        mqttProbe.abort()
    })

    test("fails fast on invalid URI syntax", async () => {
        const events = []
        const result = await mqttProbe.runProbe(
            { brokerUrl: "not-a-valid-url" },
            ev => events.push(ev)
        )

        expect(result.success).toBe(false)
        expect(result.failedStage).toBe(PROBE_STAGES.SYNTAX)
        expect(events.some(e => e.stage === PROBE_STAGES.SYNTAX && e.status === PROBE_STATUS.ERROR)).toBe(true)
    })

    test("detects mixed-content violations on HTTPS pages", async () => {
        // Simulate HTTPS page environment
        delete window.location
        window.location = new URL("https://mysite.github.io/spiderbot-mithi-web/")

        const events = []
        const result = await mqttProbe.runProbe(
            { brokerUrl: "ws://spider-w.local:9001" },
            ev => events.push(ev)
        )

        expect(result.success).toBe(false)
        expect(result.failedStage).toBe(PROBE_STAGES.SECURITY)
        expect(events.some(e => e.stage === PROBE_STAGES.SECURITY && e.status === PROBE_STATUS.ERROR)).toBe(true)
    })
})