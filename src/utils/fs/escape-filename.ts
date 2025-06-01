/**
 * Escape characters for safe filename use
 */

export function escapeFilename(title: string): string {
	return title
		.replace(/[<>:"/\\|?*]/g, '_') // Replace illegal characters
		.replace(/\./g, '·') // Replace dots with middle dots as requested
		.replace(/\s+/g, '_') // Replace spaces with underscores
		.replace(/_{2,}/g, '_') // Replace multiple underscores with single
		.replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}
