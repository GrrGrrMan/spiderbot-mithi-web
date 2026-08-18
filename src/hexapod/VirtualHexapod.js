import { POSITION_NAMES_LIST, POSITION_NAME_TO_ID_MAP, ZERO_POSE } from "./constants"
import { matrixToAlignVectorAtoB, tRotZmatrix } from "./geometry"

import Vector from "./Vector"
import Hexagon from "./Hexagon"
import Linkage from "./Linkage"

import * as oSolverGeneral from "./solvers/orient/orientSolverGeneral"
import * as oSolverSpecific from "./solvers/orient/orientSolverSpecific"

import { simpleTwist, mightTwist, complexTwist } from "./solvers/twistSolver"
import { DEFAULT_DIMENSIONS } from "../templates"

const DEFAULT_LOCAL_AXES = {
    xAxis: new Vector(1, 0, 0, "hexapodXaxis"),
    yAxis: new Vector(0, 1, 0, "hexapodYaxis"),
    zAxis: new Vector(0, 0, 1, "hexapodZaxis"),
}

const transformLocalAxes = (localAxes, twistMatrix) => ({
    xAxis: localAxes.xAxis.cloneTrot(twistMatrix),
    yAxis: localAxes.yAxis.cloneTrot(twistMatrix),
    zAxis: localAxes.zAxis.cloneTrot(twistMatrix),
})

/* * *
 build a list of six legs
 given dimensions and the respective
 bodyContacts points and pose
 * * */
const buildLegsList = (bodyContactPoints, pose, legDimensions) => {
    const safePose = pose && typeof pose === "object" ? pose : ZERO_POSE
    return POSITION_NAMES_LIST.map(
        (position, index) =>
            new Linkage(
                legDimensions,
                position,
                bodyContactPoints ? bodyContactPoints[index] : { x: 0, y: 0, z: 0 },
                (safePose && safePose[position]) || { alpha: 0, beta: 0, gamma: 0 }
            )
    )
}

const hexapodErrorInfo = () => ({
    isAlert: true,
    subject: "Unstable position.",
    body: "error in solving for orientation ",
})

const hexapodSuccessInfo = () => ({
    isAlert: false,
    subject: "Success!",
    body: "Stable orientation found.",
})

class VirtualHexapod {
    dimensions
    pose
    body
    legs
    legPositionsOnGround
    localAxes
    foundSolution

    constructor(
        dimensions,
        pose,
        flags = { hasNoPoints: false, assumeKnownGroundPoints: false, wontRotate: false }
    ) {
        this.dimensions = dimensions && typeof dimensions === "object" ? dimensions : DEFAULT_DIMENSIONS
        this.pose = pose && typeof pose === "object" ? pose : ZERO_POSE

        if (flags.hasNoPoints || !this.dimensions) {
            return
        }

        // 1. Build a flatHexagon and 'dangling' linkages
        const flatHexagon = new Hexagon(this.bodyDimensions)

        const legsNoGravity = buildLegsList(
            flatHexagon.verticesList,
            this.pose,
            this.legDimensions
        )

        // Solved orientation of body
        const solved = flags.assumeKnownGroundPoints
            ? oSolverSpecific.computeOrientationProperties(legsNoGravity)
            : oSolverGeneral.computeOrientationProperties(legsNoGravity)

        if (solved === null) {
            this.foundSolution = false
            return
        }

        this.foundSolution = true
        this.legPositionsOnGround = solved.groundLegsNoGravity.map(leg => leg.position)

        // 2. Rotate and shift legs and body given solved parameters
        const transformMatrix = matrixToAlignVectorAtoB(
            solved.nAxis,
            DEFAULT_LOCAL_AXES.zAxis
        )

        this.legs = legsNoGravity.map(leg =>
            leg.cloneTrotShift(transformMatrix, 0, 0, solved.height)
        )
        this.body = flatHexagon.cloneTrotShift(transformMatrix, 0, 0, solved.height)
        this.localAxes = transformLocalAxes(DEFAULT_LOCAL_AXES, transformMatrix)

        // 3. Twist around zAxis if needed
        if (flags.wontRotate) {
            return
        }

        if (this.legs.every(leg => leg.pose.alpha === 0)) {
            return
        }

        const twistAngle = simpleTwist(solved.groundLegsNoGravity)
        if (twistAngle !== 0) {
            this._twist(twistAngle)
            return
        }

        if (mightTwist(solved.groundLegsNoGravity)) {
            this._handleComplexTwist(flatHexagon.verticesList)
        }
    }

    get distanceFromGround() {
        return this.body.cog.z
    }

    get cogProjection() {
        return new Vector(
            this.body.cog.x,
            this.body.cog.y,
            0,
            "centerOfGravityProjectionPoint"
        )
    }

    get info() {
        return this.foundSolution ? hexapodSuccessInfo() : hexapodErrorInfo()
    }

    get bodyDimensions() {
        const { front, middle, side } = this.dimensions
        return { front, middle, side }
    }

    get legDimensions() {
        const { coxia, femur, tibia } = this.dimensions
        return { coxia, femur, tibia }
    }

    get groundContactPoints() {
        return (this.legPositionsOnGround || []).map(position => {
            const index = POSITION_NAME_TO_ID_MAP[position]
            return this.legs[index].maybeGroundContactPoint
        })
    }

    cloneTrot(transformMatrix) {
        const body = this.body.cloneTrot(transformMatrix)
        const legs = this.legs.map(leg => leg.cloneTrot(transformMatrix))
        const localAxes = transformLocalAxes(this.localAxes, transformMatrix)
        return this._buildClone(body, legs, localAxes)
    }

    cloneShift(tx, ty, tz) {
        const body = this.body.cloneShift(tx, ty, tz)
        const legs = this.legs.map(leg => leg.cloneShift(tx, ty, tz))
        return this._buildClone(body, legs, this.localAxes)
    }

    _buildClone(body, legs, localAxes) {
        let clone = new VirtualHexapod(this.dimensions, this.pose, { hasNoPoints: true })
        Object.assign(clone, {
            body,
            legs,
            localAxes,
            legPositionsOnGround: this.legPositionsOnGround,
            foundSolution: this.foundSolution,
        })
        return clone
    }

    _handleComplexTwist(verticesList) {
        const defaultLegs = buildLegsList(
            verticesList,
            ZERO_POSE,
            this.legDimensions
        )

        const defaultPoints = defaultLegs.map(
            leg => leg.cloneShift(0, 0, this.dimensions.tibia).maybeGroundContactPoint
        )

        const currentPoints = this.groundContactPoints
        const twistAngle = complexTwist(currentPoints, defaultPoints)

        if (twistAngle !== 0) {
            this._twist(twistAngle)
        }
    }

    _twist(twistAngle) {
        const twistMatrix = tRotZmatrix(twistAngle)
        this.body = this.body.cloneTrot(twistMatrix)
        this.legs = this.legs.map(leg => leg.cloneTrot(twistMatrix))
        this.localAxes = transformLocalAxes(this.localAxes, twistMatrix)
    }
}

export default VirtualHexapod