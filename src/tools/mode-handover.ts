import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from '../types/chat-types';
import { t } from 'src/i18n';
import { getStore } from "src/store/plugin-store";

type HandoverModeToolInput = {
	mode_id: string;
};

export const modeHandoverTool: ObsidianTool<HandoverModeToolInput> = {
	get specification() {
		// Dynamically generate specification with current available modes
		let availableModes: string[] = [];
		let modeDescriptions = "";
		
		const modes = Object.values(getStore().modes.available);
		const currentModeId = getStore().modes.activeId
		availableModes = modes.filter(mode => mode.ln_path !== currentModeId).map(mode => mode.ln_path);
		
		// Build a description that includes all available modes and their purposes
		if (modes.length > 0) {
			modeDescriptions = "\n\nAvailable modes:\n" + modes.map(mode => 
				`• ${mode.ln_path}: ${mode.ln_name} - ${mode.ln_description || 'No description available'}`
			).join('\n');
		}

		return {
			name: "mode_handover",
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
	get initialLabel() {
		return t('tools.handover.label');
	},
	execute: async (context: ToolExecutionContext<HandoverModeToolInput>): Promise<void> => {
		const { params } = context;
		const { mode_id } = params;
		const originalModeId = getStore().modes.activeId;

		// Get mode names for display
		const modes = Object.values(getStore().modes.available);
		const targetMode = modes.find(mode => mode.ln_path === mode_id);
		const originalMode = modes.find(mode => mode.ln_path === originalModeId);
		
		const targetModeName = targetMode?.ln_name || mode_id;
		const originalModeName = originalMode?.ln_name || originalModeId;

		context.setLabel(t('tools.handover.inProgress', { mode: targetModeName }));

		try {
			// Use the mode manager service to switch modes
			await getStore().setActiveModeWithPersistence(mode_id);
			
			context.setLabel(t('tools.handover.completed', { mode: targetModeName }));
			context.progress(t('tools.handover.completedFull', { mode: targetModeName, fromMode: originalModeName }));
		} catch (error) {
			context.setLabel(t('tools.handover.failed', { mode: targetModeName }));
			throw error;
		}
	}
}; 