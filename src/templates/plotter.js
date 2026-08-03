import { DATA, SCENE, LAYOUT, CAMERA_VIEW, DATA_INDEX_MAP } from "./"

const _getSumOfDimensions = dimensions =>
    Object.values(dimensions).reduce((sum, dimension) => sum + dimension, 0)

const _drawHexapod = hexapod => {
    const polygonVertices = hexapod.body.closedPointsList
    const bodyX = polygonVertices.map(point => point.x)
    const bodyY = polygonVertices.map(point => point.y)
    const bodyZ = polygonVertices.map(point => point.z)
    const { head, cog } = hexapod.body
    const { cogProjection, legs, groundContactPoints } = hexapod

    const dBodyMesh = {
        ...DATA[DATA_INDEX_MAP.bodyMesh],
        x: bodyX,
        y: bodyY,
        z: bodyZ,
    }

    const dBodyOutline = {
        ...DATA[DATA_INDEX_MAP.bodyOutline],
        x: bodyX,
        y: bodyY,
        z: bodyZ,
    }

    const dHead = {
        ...DATA[DATA_INDEX_MAP.head],
        x: [head.x],
        y: [head.y],
        z: [head.z],
    }

    const dCog = {
        ...DATA[DATA_INDEX_MAP.centerOfGravity],
        x: [cog.x],
        y: [cog.y],
        z: [cog.z],
    }

    const dCogProjection = {
        ...DATA[DATA_INDEX_MAP.centerOfGravityProjection],
        x: [cogProjection.x],
        y: [cogProjection.y],
        z: [cogProjection.z],
    }

    const dLegs = legs.map(leg => ({
        ...DATA[DATA_INDEX_MAP[leg.name]],
        x: leg.allPointsList.map(point => point.x),
        y: leg.allPointsList.map(point => point.y),
        z: leg.allPointsList.map(point => point.z),
    }))

    const dSupportPolygon = {
        ...DATA[DATA_INDEX_MAP.supportPolygonMesh],
        x: groundContactPoints.map(point => point.x),
        y: groundContactPoints.map(point => point.y),
        z: groundContactPoints.map(point => point.z),
    }

    const axisScale = hexapod.body.dimensions.front / 2
    const { xAxis, yAxis, zAxis } = hexapod.localAxes
    const hXaxis = {
        ...DATA[DATA_INDEX_MAP.hexapodXaxis],
        x: [cog.x, cog.x + axisScale * xAxis.x],
        y: [cog.y, cog.y + axisScale * xAxis.y],
        z: [cog.z, cog.z + axisScale * xAxis.z],
    }

    const hYaxis = {
        ...DATA[DATA_INDEX_MAP.hexapodYaxis],
        x: [cog.x, cog.x + axisScale * yAxis.x],
        y: [cog.y, cog.y + axisScale * yAxis.y],
        z: [cog.z, cog.z + axisScale * yAxis.z],
    }

    const hZaxis = {
        ...DATA[DATA_INDEX_MAP.hexapodZaxis],
        x: [cog.x, cog.x + axisScale * zAxis.x],
        y: [cog.y, cog.y + axisScale * zAxis.y],
        z: [cog.z, cog.z + axisScale * zAxis.z],
    }

    const wXaxis = {
        ...DATA[DATA_INDEX_MAP.worldXaxis],
        x: [0, axisScale],
    }

    const wYaxis = {
        ...DATA[DATA_INDEX_MAP.worldYaxis],
        y: [0, axisScale],
    }

    const wZaxis = {
        ...DATA[DATA_INDEX_MAP.worldZaxis],
        z: [0, axisScale],
    }

    return [
        dBodyMesh,
        dBodyOutline,
        dHead,
        dCog,
        dCogProjection,
        ...dLegs,
        dSupportPolygon,
        hXaxis,
        hYaxis,
        hZaxis,
        wXaxis,
        wYaxis,
        wZaxis,
    ]
}

const getNewPlotParams = (hexapod, cameraView) => {
    const data = _drawHexapod(hexapod)
    if ([null, undefined, {}].includes(cameraView)) {
        cameraView = CAMERA_VIEW
    }
    const range = _getSumOfDimensions(hexapod.dimensions)
    const newRange = [-range, range]
    const xaxis = { ...SCENE.xaxis, range: newRange }
    const yaxis = { ...SCENE.yaxis, range: newRange }
    const zaxis = { ...SCENE.zaxis, range: [-10, 2 * range - 10] }
    const scene = {
        ...SCENE,
        xaxis,
        yaxis,
        zaxis,
        camera: cameraView,
    }

    const layout = { ...LAYOUT, scene }

    return [data, layout]
}

export default getNewPlotParams
