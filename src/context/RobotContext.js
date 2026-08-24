// web-ui/src/context/RobotContext.js
import React, { createContext, useContext } from "react"

const RobotContext = createContext(null)

export const RobotProvider = ({ value, children }) => (
    <RobotContext.Provider value={value}>{children}</RobotContext.Provider>
)

export const useRobot = () => {
    const context = useContext(RobotContext)
    if (!context) {
        throw new Error("useRobot must be used within a RobotProvider")
    }
    return context
}

export default RobotContext