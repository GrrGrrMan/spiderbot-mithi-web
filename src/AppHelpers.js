import React from "react"
import { Route, Switch, Redirect } from "react-router-dom"
import { PATHS } from "./components/vars"
import * as defaults from "./templates"
import { VirtualHexapod } from "./hexapod"
import {
    InverseKinematicsPage,
    WalkingGaitsPage,
    ForwardKinematicsPage,
    LegPatternPage,
    LandingPage,
    CameraPanel,
    SensorPanel,
    AudioPanel,
    AIPanel,
} from "./components/pages"

// P2 Phase B: CameraPanel is still re-exported from ./components/pages for
// back-compat, but is no longer routed — the camera lives inside #plot as a
// stage viewport mode. The Redirect above turns /camera into /?view=camera.
const _cameraPanelKeptForBackCompat = CameraPanel

const UPDATE_TYPES = {
    DEFAULT: "default",
    POSE: "pose",
    DIMENSIONS: "dimensions",
    HEXAPOD: "hexapod",
}

const Page = ({ pageComponent }) => (
    <Switch>
        <Route path="/" exact>
            {pageComponent(LandingPage)}
        </Route>
        <Route path={PATHS.legPatterns.path} exact>
            {pageComponent(LegPatternPage)}
        </Route>
        <Route path={PATHS.forwardKinematics.path} exact>
            {pageComponent(ForwardKinematicsPage)}
        </Route>
        <Route path={PATHS.inverseKinematics.path} exact>
            {pageComponent(InverseKinematicsPage)}
        </Route>
        <Route path={PATHS.walkingGaits.path} exact>
            {pageComponent(WalkingGaitsPage)}
        </Route>
        <Route path={PATHS.camera.path} exact>
            {/* P2 Phase B: the camera is a stage viewport mode inside #plot,
                not a nav page. Redirect deep-links to /?view=camera so the
                App-level activeView state picks them up. The CameraPanel
                placeholder is kept as the legacy file but no longer routed. */}
            <Redirect to={{ pathname: "/", search: "?view=camera" }} />
        </Route>
        <Route path={PATHS.sensors.path} exact>
            {pageComponent(SensorPanel)}
        </Route>
        <Route path={PATHS.audio.path} exact>
            {pageComponent(AudioPanel)}
        </Route>
        <Route path={PATHS.ai.path} exact>
            {pageComponent(AIPanel)}
        </Route>
        <Route>
            <Redirect to="/" />
        </Route>
    </Switch>
)

const updateHexapod = (updateType, newParam, oldHexapod) => {
    const type = typeof updateType === "object" ? updateType.type : updateType
    const payload = typeof updateType === "object" ? updateType.payload : newParam

    switch (type) {
        case UPDATE_TYPES.DEFAULT:
            return new VirtualHexapod(defaults.DEFAULT_DIMENSIONS, defaults.DEFAULT_POSE)

        case UPDATE_TYPES.POSE: {
            const hexapod = new VirtualHexapod(oldHexapod.dimensions, payload.pose)
            return hexapod && hexapod.foundSolution ? hexapod : oldHexapod
        }

        case UPDATE_TYPES.DIMENSIONS: {
            const hexapod = new VirtualHexapod(payload.dimensions, oldHexapod.pose)
            return hexapod && hexapod.foundSolution ? hexapod : oldHexapod
        }

        case UPDATE_TYPES.HEXAPOD: {
            const hexapod = payload.hexapod
            return hexapod && hexapod.foundSolution ? hexapod : oldHexapod
        }

        default:
            console.warn(`[updateHexapod] Unrecognized action type: "${type}"`)
            return oldHexapod
    }
}

export { Page, updateHexapod, UPDATE_TYPES }