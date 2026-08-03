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
} from "./components/pages"

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