// web-ui/src/components/Nav.js
import React from "react"
import { URL_LINKS, PATH_LINKS } from "./vars"
import { Link } from "react-router-dom"

const NAV_BULLETS_PREFIX = "navBullet"
const NAV_DETAILED_PREFIX = "navDetailed"

// Compact, self-contained glowing status dot
const MqttStatusDot = ({ isConnected }) => {
    const dotStyle = {
        display: "inline-block",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: isConnected ? "var(--c1-green)" : "var(--c6-red)",
        boxShadow: isConnected 
            ? "0 0 8px var(--c1-green)" 
            : "0 0 8px var(--c6-red)",
        transition: "all 0.3s ease-in-out",
        cursor: "pointer"
    }
    
    return (
        <span 
            title={isConnected ? "Robot: Connected" : "Robot: Disconnected"} 
            style={dotStyle} 
        />
    )
}

const BulletPageLink = ({ link, showDesc }) => (
    <li>
        <Link to={link.path} className="link-icon">
            <span>
                {link.icon} {showDesc ? link.description : null}
            </span>
        </Link>
    </li>
)

const BulletUrlLink = ({ path, description, icon }) => (
    <li>
        <a
            href={path}
            className="link-icon"
            target="_blank"
            rel="noopener noreferrer"
            children={
                <span>
                    {icon} {description}
                </span>
            }
        />
    </li>
)

const NavBullets = ({ isConnected }) => (
    <ul 
        id="top-bar" 
        style={{ 
            display: "flex", 
            flexDirection: "row", 
            alignItems: "center", 
            flexWrap: "nowrap",
            margin: "0px",
            paddingLeft: "0px"
        }}
    >
        {URL_LINKS.map(link => (
            <BulletUrlLink
                path={link.url}
                key={NAV_BULLETS_PREFIX + link.url}
                icon={link.icon}
            />
        ))}

        {PATH_LINKS.map(link => (
            <BulletPageLink key={NAV_BULLETS_PREFIX + link.path} link={link} />
        ))}

        {/* Modular status dot sits perfectly at the end of the line */}
        <li style={{ display: "flex", alignItems: "center", marginLeft: "12px" }}>
            <MqttStatusDot isConnected={isConnected} />
        </li>
    </ul>
)

const NavDetailed = () => (
    <footer style={{ marginTop: "0px", padding: "0px" }}>
        <nav id="nav" style={{ marginTop: "0px", padding: "0px" }}>
            <ul className="grid-cols-1 no-bullet" style={{ margin: "0px", padding: "0px" }}>
                {URL_LINKS.map(link => (
                    <BulletUrlLink
                        path={link.url}
                        key={NAV_DETAILED_PREFIX + link.url}
                        icon={link.icon}
                        description={link.description}
                    />
                ))}

                {PATH_LINKS.map(link => (
                    <BulletPageLink
                        key={NAV_DETAILED_PREFIX + link.path}
                        link={link}
                        showDesc={true}
                    />
                ))}
            </ul>
        </nav>
    </footer>
)


const Nav = ({ isConnected }) => <NavBullets isConnected={isConnected} />

export { Nav, NavDetailed }