// src/hooks/__tests__/usePersistentState.test.js
import React from "react"
import { render, fireEvent } from "@testing-library/react"
import { usePersistentState } from "../usePersistentState"
import { settingsStorage } from "../../services/storage"

const TestHarness = ({ sliceKey = "llm" }) => {
    const [llm, setLlm, resetLlm] = usePersistentState(sliceKey)
    return (
        <div>
            <span data-testid="personality">{llm.personality}</span>
            <button
                data-testid="btn-change"
                onClick={() => setLlm({ personality: "guard" })}
            >
                Change
            </button>
            <button data-testid="btn-reset" onClick={resetLlm}>
                Reset
            </button>
        </div>
    )
}

describe("usePersistentState hook", () => {
    beforeEach(() => {
        window.localStorage.clear()
        settingsStorage.resetAll()
    })

    test("renders default values and updates reactively on mutation", () => {
        const { getByTestId } = render(<TestHarness />)
        expect(getByTestId("personality").textContent).toBe("friendly")

        fireEvent.click(getByTestId("btn-change"))
        expect(getByTestId("personality").textContent).toBe("guard")

        // Verify storage engine received change
        expect(settingsStorage.getSlice("llm").personality).toBe("guard")
    })

    test("resets slice to factory baseline when reset is triggered", () => {
        const { getByTestId } = render(<TestHarness />)
        fireEvent.click(getByTestId("btn-change"))
        expect(getByTestId("personality").textContent).toBe("guard")

        fireEvent.click(getByTestId("btn-reset"))
        expect(getByTestId("personality").textContent).toBe("friendly")
    })
})