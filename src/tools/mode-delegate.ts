import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { getStore } from "src/store/plugin-store";
import { delegateToModeOrCurrentChat } from "../utils/chat/chat-delegation";

type DelegateToModeToolInput = {
	mode_id: string;
	task: string;
	title?: string;
};

export const modeDelegateTool: ObsidianTool<DelegateToModeToolInput> = {
	sideEffects: true, // Creates new conversation and potentially triggers AI response
	get specification() {
		// Dynamically generate specification with current available modes
		let availableModes: string[] = [];
		let modeDescriptions = "";
		
		const modes = Object.values(getStore().modes.available);
		// Note: In the new multi-chat system, we don't filter by current mode since each chat can have different modes
		availableModes = modes.map(mode => mode.path);
		
		// Build a description that includes all available modes and their purposes
		if (modes.length > 0) {
			modeDescriptions = "\n\nAvailable modes:\n" + modes.map(mode => 
				`• ${mode.path}: ${mode.name} - ${mode.description || 'No description available'}`
			).join('\n');
		}

		return {
			name: "mode_delegate",
			description: "Delegates a self-contained task to a different AI mode that's better suited to handle it. Creates a new conversation in the specified mode with the given task, switches to the new chat, and triggers AI processing. The task must include ALL relevant context since the new conversation is completely independent. This allows you to hand off specialized work to the most appropriate mode.",
			input_schema: {
				type: "object",
				properties: {
					mode_id: {
						type: "string",
						description: `The ID (path) of the mode to delegate the task to. Choose the mode that best fits the task based on the mode's specialization and capabilities.${modeDescriptions}`,
						enum: availableModes,
					},
					task: {
						type: "string",
						description: "The self-contained task to delegate. Must include ALL relevant context, background information, and requirements since the new conversation will be completely independent and won't have access to the current conversation's context."
					},
					title: {
						type: "string",
						description: "Optional custom title for the delegated conversation. If not provided, a title will be generated automatically."
					}
				},
				required: ["mode_id", "task"]
			}
		};
	},
	icon: "forward",
	get initialLabel() {
		return t('tools.modeDelegate.labels.initial');
	},
	execute: async (context: ToolExecutionContext<DelegateToModeToolInput>): Promise<void> => {
		const { params, chatId } = context;
		const { mode_id, task, title } = params;
		const store = getStore();

		// Get mode names for display
		const modes = Object.values(store.modes.available);
		const targetMode = modes.find(mode => mode.path === mode_id);
		const targetModeName = targetMode?.name || mode_id;

		// Validate that the target mode exists
		if (!targetMode) {
			throw new Error(`Mode '${mode_id}' not found`);
		}

		context.setLabel(t('tools.modeDelegate.labels.inProgress', { mode: targetModeName }));
		context.progress(t('tools.modeDelegate.progress.processingTask', { mode: targetModeName }));

		try {
			// Use the existing delegation utility which handles all the complexity:
			// - Creates new chat if current has messages, or reuses current if empty
			// - Switches to the target chat
			// - Adds the message and triggers AI processing
			// - Ensures the chat appears in history
			const targetChatId = await delegateToModeOrCurrentChat({
				targetModeId: mode_id,
				message: task,
				currentChatId: chatId,
				title: title,
				forceNewChat: true // Always create new chat for delegation tool
			});

			context.setLabel(t('tools.modeDelegate.labels.completed', { mode: targetModeName }));
			context.progress(t('tools.modeDelegate.progress.completedFull', { 
				mode: targetModeName, 
				task: task.length > 50 ? task.substring(0, 50) + '...' : task 
			}));

		} catch (error) {
			context.setLabel(t('tools.modeDelegate.labels.failed', { mode: targetModeName }));
			throw error;
		}
	}
}; 