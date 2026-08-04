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
    // Use explicit `checked` prop if passed; otherwise check if `value` is boolean
    const isChecked = checked !== undefined ? Boolean(checked) : (typeof value === "boolean" ? value : false)

    return (
        <div className="switch-container">
            <label className="switch">
                <input 
                    id={id} 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={handleChange} 
                />
                <span className="toggle-switch-widget round"></span>
                <span style={{ opacity: 0 }}>{String(value)}</span>
            </label>
            <label className="label">{showValue ? String(value) : null}</label>
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
