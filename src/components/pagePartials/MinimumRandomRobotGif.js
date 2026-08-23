import React, { useState } from "react"

const getImageUrl = () =>
    Math.random() > 0.5 ? "./img/small-robot-small.gif" : "./img/small-robot-2-small.gif"

const MinimumRandomRobotGif = () => {
    // Only resolve a random URL strictly on the initial component mount to prevent 
    // strobing / twitching if the parent component attempts to re-render.
    const [url] = useState(getImageUrl)
    
    return (
        <img
            src={url}
            loading="lazy"
            height="75px"
            width="auto"
            alt="hexapod robot animation"
            style={{ marginTop: "10px", borderRadius: "20px" }}
        />
    )
}

export default MinimumRandomRobotGif