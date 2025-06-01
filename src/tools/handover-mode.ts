import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { modeManagerService } from "../services/ModeManagerService";
import { t } from "../i18n";

type HandoverModeToolInput = {
	mode_id: string;
};

export const handoverModeTool: ObsidianTool<HandoverModeToolInput> = {
	get specification() {
		// Dynamically generate specification with current available modes
		let availableModes: string[] = [];
		let modeDescriptions = "";
		
		try {
			if (modeManagerService.isContextAvailable()) {
				const modes = modeManagerService.getAvailableModes();
                const currentModeId = modeManagerService.getActiveModeId();
				availableModes = modes.filter(mode => mode.id !== currentModeId).map(mode => mode.id);
				
				// Build a description that includes all available modes and their purposes
				if (modes.length > 0) {
					modeDescriptions = "\n\nAvailable modes:\n" + modes.map(mode => 
						`• ${mode.id}: ${mode.name} - ${mode.description || 'No description available'}`
					).join('\n');
				}
			}
		} catch (error) {
			// Context not available yet, return empty array
		}

		return {
			name: "handover_mode",
			description: "Hand over the conversation to a different AI mode that is better suited to handle the current task or context. Use this when you recognize that another mode's specialized capabilities, personality, or context would be more appropriate for the user's needs.",
			input_schema: {
				type: "object",
				properties: {
					mode_id: {
						type: "string",
						description: `The ID (path) of the mode to switch to. Choose the mode that best fits the user's current needs based on the mode's specialization and personality.${modeDescriptions}`,
						enum: availableModes,
					}
				},
				required: ["mode_id"]
			}
		};
	},
	icon: "arrow-right-left",
	getActionText: (input: HandoverModeToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
		if (!input || typeof input !== 'object') {
			return 'Handover mode';
		}

		const modeId = input.mode_id;
		let modeName = modeId;

		// Try to get the actual mode name for better display
		try {
			if (modeManagerService.isContextAvailable()) {
				const availableModes = modeManagerService.getAvailableModes();
				const mode = availableModes.find(m => m.id === modeId);
				if (mode) {
					modeName = mode.name;
				}
			}
		} catch (error) {
			// Fall back to mode ID
		}

		if (hasError) {
			return t("tools.handover.failedToSwitch", { modeName });
		} else if (hasCompleted) {
			return t("tools.handover.switched", { modeName });
		} else if (hasStarted) {
			return t("tools.handover.switching", { modeName });
		} else {
			return `Handover to ${modeName}`;
		}
	},
	execute: async (context: ToolExecutionContext<HandoverModeToolInput>): Promise<void> => {
		try {
			const { params } = context;
			const { mode_id } = params;

			context.progress("Validating mode handover request...");

			// Validate input
			if (!mode_id || typeof mode_id !== 'string') {
				throw new ToolExecutionError(t("tools.handover.invalidModeId"));
			}

			// Check if the mode manager service is available
			if (!modeManagerService.isContextAvailable()) {
				throw new ToolExecutionError(t("tools.handover.noModes"));
			}

			context.progress("Checking available modes...");

			// Get available modes for validation
			const availableModes = modeManagerService.getAvailableModes();
			const targetMode = availableModes.find(mode => mode.id === mode_id);

			if (!targetMode) {
				throw new ToolExecutionError(t("tools.handover.modeNotFound", { modeId: mode_id }));
			}

			// Get current mode for comparison
			const currentModeId = modeManagerService.getActiveModeId();
			
			// Check if we're already in the requested mode
			if (currentModeId === mode_id) {
				context.progress(t("tools.handover.alreadyInMode", { modeName: targetMode.name }));
				return;
			}

			context.progress(`Switching to ${targetMode.name} mode...`);

			// Perform the mode change
			await modeManagerService.changeModeById(mode_id);

			// Success message with clear handover instructions for the new mode
			const currentModeName = availableModes.find(m => m.id === currentModeId)?.name || currentModeId;
			
			const handoverMessage = `${t("tools.handover.successMessage", { fromMode: currentModeName, toMode: targetMode.name })}

${t("tools.handover.newModeActive", { modeName: targetMode.name })}
${t("tools.handover.description")} ${targetMode.description || t("tools.handover.noDescription")}

${t("tools.handover.handoverInstructions")}`;

			context.progress(handoverMessage);

		} catch (error) {
			console.error('Error in handover mode tool:', error);
			
			if (error instanceof ToolExecutionError) {
				throw error;
			} else {
				throw new ToolExecutionError(t("tools.handover.switchFailed", { error: error.message }));
			}
		}
	}
}; 