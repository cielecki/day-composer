import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { getStore } from "src/store/plugin-store";
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';

type HandoverModeToolInput = {
	mode_id: string;
};

export const modeHandoverTool: ObsidianTool<HandoverModeToolInput> = {
	sideEffects: false, // Changes mode but doesn't modify files
	get specification() {
		// Dynamically generate specification with current available modes
		let availableModes: string[] = [];
		let modeDescriptions = "";
		
		const modes = Object.values(getStore().modes.available);
		// For the specification, we show all modes. The actual filtering will happen
		// during execution when we have access to the current chat's mode via context
		availableModes = modes.map(mode => mode.path);
		
		// Build a description that includes all available modes and their purposes
		if (modes.length > 0) {
			modeDescriptions = "\n\nAvailable modes:\n" + modes.map(mode => 
				`• ${mode.path}: ${mode.name} - ${mode.description || 'No description available'}`
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
    return t('tools.handover.labels.initial');
  },
	execute: async (context: ToolExecutionContext<HandoverModeToolInput>): Promise<void> => {
		const { params, chatId } = context;
		const { mode_id } = params;
		// Get the current mode for this specific chat
		const chatState = getStore().getChatState(chatId);
		const originalModeId = chatState?.activeModeId || DEFAULT_MODE_ID;

		// Get mode names for display
		const modes = Object.values(getStore().modes.available);
		const targetMode = modes.find(mode => mode.path === mode_id);
		const originalMode = modes.find(mode => mode.path === originalModeId);
		
		const targetModeName = targetMode?.name || mode_id;
		const originalModeName = originalMode?.name || originalModeId;

		context.setLabel(t('tools.handover.labels.inProgress', { mode: targetModeName }));

		try {
			// Use per-chat mode switching - only affects the current chat, not other chats
			getStore().setActiveModeForChat(context.chatId, mode_id);
			
			context.setLabel(t('tools.handover.labels.completed', { mode: targetModeName }));
			        context.progress(t('tools.handover.progress.completedFull', { mode: targetModeName, fromMode: originalModeName }));
		} catch (error) {
			context.setLabel(t('tools.handover.labels.failed', { mode: targetModeName }));
			throw error;
		}
	}
}; 