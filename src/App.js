import React, { useState, useEffect } from "react"
import { BrowserRouter as Router } from "react-router-dom"
import { DEFAULT_POSE } from "./templates"
import { SECTION_NAMES } from "./components/vars"
import { Nav, NavDetailed, DimensionsWidget } from "./components"
import { updateHexapod, Page } from "./AppHelpers"
import HexapodPlot from "./components/HexapodPlot"
import { useMqtt } from "./hooks/useMqtt"

window.dataLayer = window.dataLayer || []
function gtag() {
    window.dataLayer.push(arguments)
}

function App() {
    const [inHexapodPage, setInHexapodPage] = useState(false)
    const [hexapod, setHexapod] = useState(() => updateHexapod("default"))
    const [revision, setRevision] = useState(0)

    // 1. Initialize our central MQTT communication hook
    const { isConnected, telemetry, logs, publishImmediate } = useMqtt()

    // 2. 1Hz Keep-Alive Watchdog Heartbeat
    useEffect(() => {
        if (!isConnected) return
        
        const interval = setInterval(() => {
            publishImmediate("hexapod/cmd", { type: "system", ping: true })
        }, 1000) // Emit lightweight system ping every 1000ms

        return () => clearInterval(interval)
    }, [isConnected, publishImmediate])

    /* * * * * * * * * * * * * *
     * Page load Callback
     * * * * * * * * * * * * * */
    const onPageLoad = pageName => {
        document.title = pageName + " - Mithi's Bare Minimum Hexapod Robot Simulator"
        gtag("config", "UA-170794768-1", {
            page_path: window.location.pathname + window.location.search,
        })

        if (pageName === SECTION_NAMES.landingPage) {
            setInHexapodPage(false)
            return
        }

        setInHexapodPage(true)
        manageState("pose", { pose: DEFAULT_POSE })
    }

    /* * * * * * * * * * * * * *
     * State Management Callback
     * * * * * * * * * * * * * */
    const manageState = (updateType, newParam) => {
        setHexapod(prevHexapod => {
            const nextHexapod = updateHexapod(updateType, newParam, prevHexapod)
            setRevision(prev => prev + 1)
            return nextHexapod
        })
    }

    /* * * * * * * * * * * * * *
     * Page Component Prototype
     * * * * * * * * * * * * * */
    const pageComponent = Component => (
        <Component
            onMount={onPageLoad}
            onUpdate={manageState}
            params={{
                dimensions: hexapod.dimensions,
                pose: hexapod.pose,
            }}
        />
    )

    /* * * * * * * * * * * * * *
     * Layout Rendering
     * * * * * * * * * * * * * */
    return (
        <Router>
            <Nav />
            <div id="main">
                <div id="sidebar">
                    {/* Live connection HUD widget */}
                    <div className="border" style={{ marginBottom: "15px", padding: "10px" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: "bold" }}>
                            ROBOT STATUS:{" "}
                        </span>
                        <span 
                            className={!isConnected ? "red" : ""} 
                            style={{ 
                                fontSize: "0.75rem", 
                                color: isConnected ? "var(--c1-green)" : "var(--c6-red)",
                                fontWeight: "bolder"
                            }}
                        >
                            {isConnected ? "CONNECTED TO BROKER" : "DISCONNECTED"}
                        </span>
                    </div>

                    <div hidden={!inHexapodPage}>
                        <DimensionsWidget
                            params={{ dimensions: hexapod.dimensions }}
                            onUpdate={manageState}
                        />
                    </div>
                    <Page pageComponent={pageComponent} />
                    {!inHexapodPage ? <NavDetailed /> : null}
                </div>
                <div id="plot" className="border" hidden={!inHexapodPage}>
                    <HexapodPlot
                        revision={revision}
                        hexapod={hexapod}
                    />
                </div>
            </div>
            {inHexapodPage ? <NavDetailed /> : null}
        </Router>
    )
}

export default App
