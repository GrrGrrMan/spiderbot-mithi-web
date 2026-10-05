// src/components/hub/HubMqttView.js
import React from "react"
import { MqttTargetingPanel } from "../mqtt/MqttTargetingPanel"

export const HubMqttView = props => (
    <div style={{ display: "flex", flexDirection: "column" }}>
        <MqttTargetingPanel {...props} />
    </div>
)

export default HubMqttView