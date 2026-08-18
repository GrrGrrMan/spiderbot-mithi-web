// web-ui/src/components/viewport/__tests__/ViewportToggle.test.js
import React from "react"
import "@testing-library/jest-dom/extend-expect"
import { render, fireEvent, screen } from "@testing-library/react"
import ViewportToggle from "../ViewportToggle"

describe("ViewportToggle", () => {
    it("renders both SIM and CAM tabs with proper aria semantics", () => {
        render(<ViewportToggle activeView="sim" onChange={() => {}} />)

        const tablist = screen.getByRole("tablist", { name: /stage viewport/i })
        expect(tablist).toBeInTheDocument()
        expect(tablist).toHaveAttribute("data-testid", "viewport-toggle")

        const simTab = screen.getByTestId("viewport-toggle-sim")
        const camTab = screen.getByTestId("viewport-toggle-cam")
        expect(simTab).toHaveAttribute("role", "tab")
        expect(camTab).toHaveAttribute("role", "tab")
        expect(simTab).toHaveAttribute("aria-selected", "true")
        expect(camTab).toHaveAttribute("aria-selected", "false")
    })

    it("fires onChange('cam') when the CAM tab is clicked", () => {
        const onChange = jest.fn()
        render(<ViewportToggle activeView="sim" onChange={onChange} />)

        fireEvent.click(screen.getByTestId("viewport-toggle-cam"))
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith("cam")
    })

    it("fires onChange('sim') when the SIM tab is clicked", () => {
        const onChange = jest.fn()
        render(<ViewportToggle activeView="cam" onChange={onChange} />)

        fireEvent.click(screen.getByTestId("viewport-toggle-sim"))
        expect(onChange).toHaveBeenCalledWith("sim")
    })

    it("reflects the activeView prop on the correct tab", () => {
        const { rerender } = render(
            <ViewportToggle activeView="sim" onChange={() => {}} />
        )
        expect(screen.getByTestId("viewport-toggle-sim")).toHaveAttribute(
            "aria-selected",
            "true"
        )
        expect(screen.getByTestId("viewport-toggle-cam")).toHaveAttribute(
            "aria-selected",
            "false"
        )

        rerender(<ViewportToggle activeView="cam" onChange={() => {}} />)
        expect(screen.getByTestId("viewport-toggle-sim")).toHaveAttribute(
            "aria-selected",
            "false"
        )
        expect(screen.getByTestId("viewport-toggle-cam")).toHaveAttribute(
            "aria-selected",
            "true"
        )
    })

    it("renders the visible SIM/CAM labels", () => {
        render(<ViewportToggle activeView="sim" onChange={() => {}} />)
        expect(screen.getByText("SIM")).toBeInTheDocument()
        expect(screen.getByText("CAM")).toBeInTheDocument()
    })
})