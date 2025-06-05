import React from "react";
import { getIcon } from "obsidian";

interface LucideIconProps {
	name: string;
	size?: number;
	className?: string;
	color?: string;
}

/**
 * Component to render Lucide icons available in Obsidian
 * Uses Obsidian's getIcon function to access built-in icons
 */
export const LucideIcon: React.FC<LucideIconProps> = ({
	name,
	size = 20,
	className = "",
	color,
}) => {
	const containerRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (containerRef.current) {
			// Clear any existing content by removing all child nodes
			while (containerRef.current.firstChild) {
				containerRef.current.removeChild(containerRef.current.firstChild);
			}
			
			try {
				// Get the icon as SVG from Obsidian
				const iconEl = getIcon(name);
				if (iconEl) {
					// Safely append the icon element directly
					containerRef.current.appendChild(iconEl);
				} else {
					console.warn(`Icon "${name}" not found`);
				}
			} catch (e) {
				console.error(`Error loading icon "${name}":`, e);
			}
		}
	}, [name]);

	return (
		<div
			ref={containerRef}
			className={`lucide-icon ${className}`}
			style={{
				width: size,
				height: size,
				color: color || "inherit",
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		/>
	);
};
