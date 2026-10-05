// src/services/storage/__tests__/phase4Persistence.test.js
import { settingsStorage } from "../SettingsStorageService"
import { DEFAULT_APP_SETTINGS } from "../schemaDefaults"

describe("Phase 4: Targeted Settings Data Traces Persistence", () => {
    beforeEach(() => {
        window.localStorage.clear()
        settingsStorage.resetAll()
    })

    test("persists and rehydrates LLM parameters and custom prompt", () => {
        const patch = {
            model: "hexapod-vision-v2",
            thinkingLevel: "high",
            personality: "curious",
            temperature: 0.7,
            customInstructions: "Always check stance clearance before moving.",
        }

        settingsStorage.setSlice("llm", patch)

        const retrieved = settingsStorage.getSlice("llm")
        expect(retrieved.model).toBe("hexapod-vision-v2")
        expect(retrieved.thinkingLevel).toBe("high")
        expect(retrieved.personality).toBe("curious")
        expect(retrieved.temperature).toBe(0.7)
        expect(retrieved.customInstructions).toBe("Always check stance clearance before moving.")
    })

    test("persists and updates AI Memory mode and learned fact pool", () => {
        settingsStorage.setSlice("memory", {
            mode: "persistent",
            memoryPool: { user_name: "Alice", home_pos: "lab_bench_1" },
        })

        const mem = settingsStorage.getSlice("memory")
        expect(mem.mode).toBe("persistent")
        expect(mem.memoryPool.user_name).toBe("Alice")
        expect(mem.memoryPool.home_pos).toBe("lab_bench_1")

        // Add a fact dynamically
        settingsStorage.setSlice("memory", {
            memoryPool: { ...mem.memoryPool, patrol_speed: "fast" },
        })

        const updated = settingsStorage.getSlice("memory")
        expect(updated.memoryPool.patrol_speed).toBe("fast")
        expect(updated.memoryPool.user_name).toBe("Alice")
    })

    test("persists UI activeTab without modifying coordinate geometry", () => {
        settingsStorage.setSlice("ui", { activeTab: "mqtt" })
        const ui = settingsStorage.getSlice("ui")
        expect(ui.activeTab).toBe("mqtt")
        expect(ui.modalPos).toEqual(DEFAULT_APP_SETTINGS.ui.modalPos)
    })

    test("notifies subscribers when LLM or Memory slice changes", () => {
        const callback = jest.fn()
        const unsubscribe = settingsStorage.subscribe(callback)

        settingsStorage.setSlice("llm", { temperature: 0.15 })

        expect(callback).toHaveBeenCalledWith(
            expect.objectContaining({
                llm: expect.objectContaining({ temperature: 0.15 }),
            }),
            "llm"
        )

        unsubscribe()
    })

    test("exportBackup safely excludes MQTT password while retaining LLM and Memory traces", () => {
        settingsStorage.setSlice("mqtt", { password: "super_secret_pw", rememberAuth: true })
        settingsStorage.setSlice("llm", { customInstructions: "Test prompt" })
        settingsStorage.setSlice("memory", { memoryPool: { key1: "val1" } })

        const jsonStr = settingsStorage.exportBackup()
        const parsed = JSON.parse(jsonStr)

        expect(parsed.mqtt.password).toBe("")
        expect(parsed.llm.customInstructions).toBe("Test prompt")
        expect(parsed.memory.memoryPool.key1).toBe("val1")
    })
})