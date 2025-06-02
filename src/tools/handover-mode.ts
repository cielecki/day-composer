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
	initialLabel: t('tools.handover.label'),
	execute: async (context: ToolExecutionContext<HandoverModeToolInput>): Promise<void> => {
		const { plugin, params } = context;
		const { mode_id } = params;

		context.setLabel(t('tools.handover.inProgress', { mode: mode_id }));

		try {
			// Use the mode manager service to switch modes
			await modeManagerService.changeModeById(mode_id);
			
			// Add a message about the handover
			const handoverMessage = t('tools.handover.noReason', { mode: mode_id });

			context.setLabel(t('tools.handover.completed', { mode: mode_id }));
			context.progress(handoverMessage);
		} catch (error) {
			context.setLabel(t('tools.handover.failed', { mode: mode_id }));
			throw error;
		}
	}
}; 