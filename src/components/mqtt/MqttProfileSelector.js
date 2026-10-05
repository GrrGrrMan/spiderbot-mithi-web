// src/components/mqtt/MqttProfileSelector.js
import React from "react"
import { PRESET_PROFILES } from "../../constants/presetProfiles"

export const MqttProfileSelector = ({ activePresetId, onSelectPreset }) => (
    <div style={{ marginBottom: "10px" }}>
        <span style={labelStyle}>QUICK-SELECT TARGET PROFILES:</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {PRESET_PROFILES.map(profile => {
                const isSelected = activePresetId === profile.id
                return (
                    <button
                        key={profile.id}
                        type="button"
                        onClick={() => onSelectPreset(profile)}
                        title={profile.description}
                        style={{
                            ...chipBtnStyle,
                            backgroundColor: isSelected ? "rgba(255, 121, 63, 0.25)" : "rgba(23, 33, 43, 0.8)",
                            borderColor: isSelected ? "var(--c3-orange)" : "rgba(41, 128, 185, 0.4)",
                            color: isSelected ? "var(--c3-orange)" : "#cbd5e1",
                        }}
                    >
                        <span>{profile.name}</span>
                        <span
                            style={{
                                fontSize: "0.55rem",
                                padding: "1px 4px",
                                borderRadius: "3px",
                                backgroundColor: isSelected ? "var(--c3-orange)" : "rgba(41, 128, 185, 0.4)",
                                color: isSelected ? "#000" : "#94a3b8",
                                fontWeight: "bold",
                            }}
                        >
                            {profile.badge}
                        </span>
                    </button>
                )
            })}
        </div>
    </div>
)

const labelStyle = {
    fontSize: "0.6rem",
    fontWeight: "bold",
    color: "#94a3b8",
    display: "block",
    marginBottom: "4px",
}

const chipBtnStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 8px",
    borderRadius: "5px",
    border: "1px solid",
    fontSize: "0.65rem",
    cursor: "pointer",
    fontWeight: "500",
    transition: "all 0.15s ease",
}

export default MqttProfileSelector