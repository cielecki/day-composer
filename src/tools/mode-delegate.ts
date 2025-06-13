import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { getStore } from "src/store/plugin-store";
import { generateChatId } from "src/utils/chat/generate-conversation-id";
import { CURRENT_SCHEMA_VERSION } from "src/utils/chat/conversation";
import { createUserMessage } from "src/utils/chat/message-builder";

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
			description: "Delegates a self-contained task to a different AI mode that's better suited to handle it. Creates a new conversation in the specified mode with the given task, and triggers AI processing in the background. The task must include ALL relevant context since the new conversation is completely independent. This is fire-and-forget delegation - the original conversation continues independently while the delegated task is processed.",
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
		const { params } = context;
		const { mode_id, task, title } = params;
		const store = getStore();

		// Get mode names for display
		const modes = Object.values(store.modes.available);
		const targetMode = modes.find(mode => mode.path === mode_id);
		const targetModeName = targetMode?.name || mode_id;

		context.setLabel(t('tools.modeDelegate.labels.inProgress', { mode: targetModeName }));

		// Create new conversation with the delegated task
		const newChatId = generateChatId();
		
		try {
			// Validate that the target mode exists
			if (!targetMode) {
				throw new Error(`Mode '${mode_id}' not found`);
			}
			const taskMessage = createUserMessage(task);
			
			const newConversation = {
				meta: {
					id: newChatId,
					title: title || t('chat.titles.newChat'),
					filePath: '',
					updatedAt: Date.now()
				},
				storedConversation: {
					version: CURRENT_SCHEMA_VERSION,
					title: title || t('chat.titles.newChat'),
					isUnread: false, // New conversations start as read
					modeId: mode_id, // Set the correct mode
					titleGenerated: !title, // If no title provided, allow auto-generation
					messages: [taskMessage],
					costData: {
						total_cost: 0,
						total_input_tokens: 0,
						total_output_tokens: 0,
						total_cache_write_tokens: 0,
						total_cache_read_tokens: 0,
						entries: [],
					}
				}
			};

			// Load the new conversation into a temporary chat slot
			store.setCurrentChat(newChatId, newConversation);
			store.setActiveModeForChat(newChatId, mode_id);
			
			context.progress(t('tools.modeDelegate.progress.processingTask', { mode: targetModeName }));
			
			// Process the AI response in the background
			// This will add the AI response to the conversation
			await store.runConversationTurnWithContext(newChatId);
			
			// Save the completed conversation with AI response
			await store.saveConversation(newChatId);
			
			context.progress(t('tools.modeDelegate.progress.createdChat', { mode: targetModeName }));
			
			// Clean up the temporary chat from memory (but keep the saved file)
			await store.unloadChat(newChatId);
			
			context.setLabel(t('tools.modeDelegate.labels.completed', { mode: targetModeName }));
			context.progress(t('tools.modeDelegate.progress.completedFull', { 
				mode: targetModeName, 
				task: task.length > 50 ? task.substring(0, 50) + '...' : task 
			}));

		} catch (error) {
			// Clean up any temporary chat that might have been created
			try {
				if (store.getChatState(newChatId)) {
					await store.unloadChat(newChatId);
				}
			} catch (cleanupError) {
				console.error('Failed to clean up temporary chat after delegation error:', cleanupError);
			}
			
			context.setLabel(t('tools.modeDelegate.labels.failed', { mode: targetModeName }));
			throw error;
		}
	}
}; 