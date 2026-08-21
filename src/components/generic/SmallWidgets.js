import React from "react"
import { ICON_COMPONENTS, RESET_LABEL } from "../vars"

const AlertBox = ({ info }) => (
    <div className="message">
        <h2 className="red">
            {ICON_COMPONENTS.times} {info.subject}
        </h2>
        <p>{info.body}</p>
    </div>
)

const ToggleSwitch = ({ id, value, handleChange, showValue, checked }) => {
    // Determine checked state from explicit prop, boolean value, or truthy string matching
    let isChecked = false
    if (checked !== undefined) {
        isChecked = Boolean(checked)
    } else if (typeof value === "boolean") {
        isChecked = value
    } else if (typeof value === "string") {
        isChecked = ["true", "1", "1x", "slide", "playing...", "controlsShown", "tripodGait", "isForward", "isWalk"].includes(value.toLowerCase().trim())
    }

    return (
        <div className="switch-container">
            <label className="switch" htmlFor={id}>
                <input 
                    id={id} 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={handleChange} 
                />
                <span className="toggle-switch-widget round"></span>
                <span style={{ opacity: 0 }}>{String(value)}</span>
            </label>
            <label className="label" htmlFor={id}>{showValue ? String(value) : null}</label>
        </div>
    )
}

const Card = ({ title, other, children }) => (
    <div>
        <div className="card-header">
            {title}
            {other}
        </div>
        {children}
    </div>
)

const BasicButton = ({ handleClick, children }) => (
    <button type="button" className="button" onClick={handleClick}>
        {children}
    </button>
)

const ResetButton = ({ reset }) => (
    <BasicButton handleClick={reset}>{RESET_LABEL}</BasicButton>
)

export { AlertBox, Card, ToggleSwitch, BasicButton, ResetButton }
