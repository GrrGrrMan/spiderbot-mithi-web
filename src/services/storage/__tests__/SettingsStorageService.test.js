// src/services/storage/__tests__/SettingsStorageService.test.js
import { settingsStorage } from "../SettingsStorageService"
import { STORAGE_KEY, DEFAULT_APP_SETTINGS } from "../schemaDefaults"

describe("SettingsStorageService", () => {
    beforeEach(() => {
        window.localStorage.clear()
        settingsStorage.resetAll()
    })

    test("initializes with schema defaults", () => {
        const settings = settingsStorage.getSettings()
        expect(settings._version).toBe(1)
        expect(settings.mqtt.deviceId).toBe("hexapod-s3-01")
        expect(settings.llm.model).toBe("hexapod-vision")
    })

    test("persists slice changes synchronously when debounceMs is 0", () => {
        settingsStorage.setSlice("mqtt", { brokerUrl: "wss://custom-broker:8884/mqtt" })
        
        const raw = window.localStorage.getItem(STORAGE_KEY)
        expect(raw).toBeTruthy()
        const parsed = JSON.parse(raw)
        expect(parsed.mqtt.brokerUrl).toBe("wss://custom-broker:8884/mqtt")
    })

    test("debounces disk writes when debounceMs > 0", done => {
        jest.useFakeTimers()

        settingsStorage.setSlice("llm", { temperature: 0.95 }, { debounceMs: 200 })
        
        // Before timer runs, localStorage has not updated to 0.95
        let parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
        expect(parsed.llm.temperature).toBe(DEFAULT_APP_SETTINGS.llm.temperature)

        // Advance timer
        jest.advanceTimersByTime(250)

        parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
        expect(parsed.llm.temperature).toBe(0.95)

        jest.useRealTimers()
        done()
    })

    test("sanitizes password on write if rememberAuth is false", () => {
        settingsStorage.setSlice("mqtt", {
            password: "super-secret-password",
            rememberAuth: false,
        })

        const raw = window.localStorage.getItem(STORAGE_KEY)
        const parsed = JSON.parse(raw)
        expect(parsed.mqtt.password).toBe("")
    })

    test("exports and imports valid backup files correctly", () => {
        settingsStorage.setSlice("ui", { activeView: "dual", smartSpeaker: true })
        const jsonBackup = settingsStorage.exportBackup()
        
        settingsStorage.resetAll()
        expect(settingsStorage.getSlice("ui").activeView).toBe("sim")

        const result = settingsStorage.importBackup(jsonBackup)
        expect(result.success).toBe(true)
        expect(settingsStorage.getSlice("ui").activeView).toBe("dual")
        expect(settingsStorage.getSlice("ui").smartSpeaker).toBe(true)
    })
})