import { LNMode } from "../types/types";

/**
 * Singleton service that provides external access to mode management
 * while bridging with the React context system for reactivity.
 */
class ModeManagerService {
	private static instance: ModeManagerService | null = null;
	
	private contextSetters: {
		setActiveModeId?: (modeId: string) => Promise<void>;
		getCurrentModes?: () => Record<string, LNMode>;
		getActiveModeId?: () => string;
	} = {};

	private constructor() {
		// Private constructor for singleton pattern
	}

	static getInstance(): ModeManagerService {
		if (!ModeManagerService.instance) {
			ModeManagerService.instance = new ModeManagerService();
		}
		return ModeManagerService.instance;
	}

	/**
	 * Called by the React context to register its state management functions
	 * This creates the bridge between external tools and React state
	 */
	registerContextBridge(setters: {
		setActiveModeId: (modeId: string) => Promise<void>;
		getCurrentModes: () => Record<string, LNMode>;
		getActiveModeId: () => string;
	}) {
		this.contextSetters = setters;
	}

	/**
	 * Unregister the context bridge (useful for cleanup)
	 */
	unregisterContextBridge() {
		this.contextSetters = {};
	}

	/**
	 * Get all available modes
	 */
	getAllModes(): Record<string, LNMode> {
		if (!this.contextSetters.getCurrentModes) {
			throw new Error('Mode context not available - React context not registered');
		}
		return this.contextSetters.getCurrentModes();
	}

	/**
	 * Get the currently active mode ID
	 */
	getActiveModeId(): string {
		if (!this.contextSetters.getActiveModeId) {
			throw new Error('Mode context not available - React context not registered');
		}
		return this.contextSetters.getActiveModeId();
	}

	/**
	 * Get the currently active mode
	 */
	getActiveMode(): LNMode | null {
		const modes = this.getAllModes();
		const activeModeId = this.getActiveModeId();
		return modes[activeModeId] || null;
	}

	/**
	 * Change the active mode by ID
	 * This is the main function that tools will call
	 */
	async changeModeById(modeId: string): Promise<void> {
		if (!this.contextSetters.setActiveModeId) {
			throw new Error('Mode context not available - React context not registered');
		}

		const modes = this.getAllModes();
		const mode = modes[modeId];

		if (!mode) {
			const availableModes = Object.keys(modes).join(', ');
			throw new Error(`Mode "${modeId}" not found. Available modes: ${availableModes}`);
		}

		await this.contextSetters.setActiveModeId(modeId);
	}

	/**
	 * Get a list of all available modes with their metadata
	 * Useful for tools that need to present mode options
	 */
	getAvailableModes(): Array<{
		id: string;
		name: string;
		description: string;
		icon?: string;
		iconColor?: string;
	}> {
		const modes = this.getAllModes();
		return Object.values(modes).map(mode => ({
			id: mode.ln_path,
			name: mode.ln_name,
			description: mode.ln_description,
			icon: mode.ln_icon,
			iconColor: mode.ln_icon_color,
		}));
	}

	/**
	 * Check if the service is properly initialized and connected to React context
	 */
	isContextAvailable(): boolean {
		return !!(
			this.contextSetters.setActiveModeId &&
			this.contextSetters.getCurrentModes &&
			this.contextSetters.getActiveModeId
		);
	}
}

// Export singleton instance
export const modeManagerService = ModeManagerService.getInstance();
export default modeManagerService; 