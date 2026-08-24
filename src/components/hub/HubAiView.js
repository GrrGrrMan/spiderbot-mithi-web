// web-ui/src/components/hub/HubAiView.js
import React from "react"
import { AiAssistantView } from "../ai/AiAssistantView"

export const HubAiView = (props) => (
    <AiAssistantView
        {...props}
        isConfigOpen={props.isConfigOpen}
        onToggleConfig={() => props.setIsConfigOpen(prev => !prev)}
        variant="hub"
    />
)

export default HubAiView