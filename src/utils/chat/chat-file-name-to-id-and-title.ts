/**
	 * Parse conversation ID and title from filename
	 */
export function chatFileNameToIdAndTitle(filename: string): { id: string; title: string; } | null {
	if (!filename.endsWith('.json')) {
		return null;
	}

	const nameWithoutExt = filename.slice(0, -5); // Remove .json
	const dashIndex = nameWithoutExt.indexOf('-');

	if (dashIndex === -1) {
		return null;
	}

	const id = nameWithoutExt.substring(0, dashIndex);
	const escapedTitle = nameWithoutExt.substring(dashIndex + 1);

	// Unescape title
	const title = escapedTitle
		.replace(/_/g, ' ')
		.replace(/·/g, '.'); // Convert middle dots back to regular dots

	return { id, title };
}
