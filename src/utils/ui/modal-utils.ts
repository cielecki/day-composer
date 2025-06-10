/**
 * Utility functions for working with Obsidian modals
 */

/**
 * Closes the currently open settings modal by attempting to click the close button
 * or falling back to manual removal if the close button is not found.
 * 
 * This is useful when programmatically triggering actions that should close
 * the settings dialog (like opening files or switching modes).
 */
export function closeCurrentSettingsModal(): void {
	try {
		const settingsModal = document.querySelector('.modal-container');
		if (settingsModal) {
			// Find and click the close button or trigger close
			const closeBtn = settingsModal.querySelector('.modal-close-button') as HTMLElement;
			if (closeBtn) {
				closeBtn.click();
			} else {
				// Fallback: remove modal manually
				settingsModal.remove();
			}
		}
	} catch (error) {
		console.error('Error closing settings modal:', error);
	}
} 