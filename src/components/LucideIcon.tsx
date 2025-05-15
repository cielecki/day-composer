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
	const [svg, setSvg] = React.useState<string>("");

	React.useEffect(() => {
		try {
			// Get the icon as SVG from Obsidian
			const iconEl = getIcon(name);
			if (iconEl) {
				// Convert to string
				const svgString = iconEl.outerHTML;
				setSvg(svgString);
			} else {
				console.warn(`Icon "${name}" not found`);
			}
		} catch (e) {
			console.error(`Error loading icon "${name}":`, e);
		}
	}, [name]);

	// If we have an SVG, render it
	if (svg) {
		return (
			<div
				className={`lucide-icon ${className}`}
				style={{
					width: size,
					height: size,
					color: color || "inherit",
				}}
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
		);
	}

	// Fallback if icon not found
	return (
		<div
			className={`lucide-icon-fallback ${className}`}
			style={{
				width: size,
				height: size,
				color: color || "inherit",
			}}
		/>
	);
};
