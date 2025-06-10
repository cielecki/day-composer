import { Anthropic, APIUserAbortError } from "@anthropic-ai/sdk";
import { MessageCreateParamsStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import { Message, ToolResultBlock } from "../../types/message";
import { formatMessagesForAPI } from "./api-formatting";
import { processAnthropicStream, StreamProcessorCallbacks } from "./stream-processor";
import { processToolUseBlocks } from "./tool-processing";
import { getToolUseBlocks, hasIncompleteToolCalls, hasIncompleteThinking, clearThinkingInProgress } from "./content-blocks";
import { cleanupLastMessage } from "./message-validation";
import { getStore } from "../../store/plugin-store";
import { getDefaultLNMode, resolveAutoModel } from '../../utils/modes/ln-mode-defaults';
import type { ObsidianTool } from "../../obsidian-tools";
import { usePluginStore } from "../../store/plugin-store";

/**
 * Runs a complete conversation turn with the AI, handling tool calls and streaming
 */
export const runConversationTurn = async (
	tools: ObsidianTool<Record<string, unknown>>[],
	signal: AbortSignal
): Promise<Message | null> => {
	const store = usePluginStore.getState();
	
	// Manage loading state within this function
	store.setIsGenerating(true);
	let currentTurnAborted = false;
	let finalAssistantMessageForTTS: Message | null = null;

	// Clear any previous aborted tool results when starting a new turn
	store.clearLiveToolResults();

	// Track current mode for system prompt optimization
	let currentModeId: string = store.modes.activeId;
	let systemPrompt: string = '';
	let systemPromptCalculated = false;

	try {
		// Get current messages array
		const messages = [...store.chats.current.storedConversation.messages];
		
		// Validate messages array before starting
		if (!Array.isArray(messages)) {
			console.error("Invalid messages array in conversation turn");
			return null;
		}

		// Outer try for the whole turn process
		while (!signal.aborted && !currentTurnAborted) {
			let assistantMessage: Message | null = null;

			try {
				const apiKey = getStore().getSecret('ANTHROPIC_API_KEY');
				const anthropicClient = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

				// Create a stable reference to messages for API formatting
				const currentMessages = [...usePluginStore.getState().chats.current.storedConversation.messages];
				const messagesForAPI = formatMessagesForAPI(currentMessages);

				const defaultMode = getDefaultLNMode();

				// Get API parameters from active mode or defaults
				const currentStore = usePluginStore.getState();
				const currentActiveMode = currentStore.modes.available[currentStore.modes.activeId];
				
				// Only recalculate system prompt if mode changed or not yet calculated
				if (!systemPromptCalculated || currentModeId !== currentStore.modes.activeId) {
					currentModeId = currentStore.modes.activeId;
					
					// Generate system prompt
					systemPrompt = await currentStore.getSystemPrompt();
					
					systemPromptCalculated = true;
					console.debug('[CONVERSATION-TURN] Recalculated system prompt for mode:', currentModeId);
				} else {
					console.debug('[CONVERSATION-TURN] Reusing system prompt for mode:', currentModeId);
				}
				
				const rawModel = currentActiveMode?.model ?? defaultMode.model;
				
				// Resolve "auto" model to actual model based on mode characteristics
				const model = rawModel === "auto" 
					? resolveAutoModel(currentActiveMode || defaultMode)
					: rawModel;
					
				const maxTokens = currentActiveMode.max_tokens ?? defaultMode.max_tokens;
				const thinkingBudgetTokens = currentActiveMode.thinking_budget_tokens ?? defaultMode.thinking_budget_tokens;

				const params: MessageCreateParamsStreaming = {
					model: model,
					max_tokens: maxTokens,
					system: systemPrompt,
					stream: true,
					messages: messagesForAPI,
					tools: tools.map((tool) => tool.specification as Anthropic.Messages.Tool),
					thinking: {
						type: "enabled",
						budget_tokens: thinkingBudgetTokens,
					},
				};

				console.debug("🔥 API Params:", params);

				const stream = await anthropicClient.messages.create(params, { signal: signal });

				// Set up stream processor callbacks
				const callbacks: StreamProcessorCallbacks = {
					onMessageStart: () => {
						assistantMessage = { role: "assistant", content: [] };
						usePluginStore.getState().addMessage(assistantMessage);
					},
					onMessageUpdate: (message: Message) => {
						// Validate message before updating
						if (!message || typeof message !== 'object') {
							console.warn("Invalid message in stream update, skipping");
							return;
						}
						assistantMessage = message;
						const currentStore = usePluginStore.getState();
						const messages = currentStore.chats.current.storedConversation.messages;
						if (messages.length > 0) {
							currentStore.updateMessage(messages.length - 1, message);
						}
					},
					onMessageStop: (finalMessage: Message) => {
						// Validate final message
						if (!finalMessage || typeof finalMessage !== 'object') {
							console.warn("Invalid final message in stream stop, skipping");
							return;
						}
						assistantMessage = finalMessage;
						usePluginStore.getState().saveConversation();
					},
					onAbort: () => {
						currentTurnAborted = true;
					}
				};

				// Process the stream
				const turnResult = await processAnthropicStream(stream, signal, callbacks);

				if (turnResult.aborted || signal.aborted) {
					// Handle cleanup for aborted stream
					handleStreamAbortCleanup();
					currentTurnAborted = true;
					break; // Exit the while loop
				}

				if (turnResult.finalContent && assistantMessage) {
					// Check for tool use
					const toolUseBlocks = getToolUseBlocks(turnResult.finalContent);

					if (toolUseBlocks.length > 0) {
						const { getObsidianTools } = await import("../../obsidian-tools");
						const { LifeNavigatorPlugin } = await import("../../LifeNavigatorPlugin");
						const plugin = LifeNavigatorPlugin.getInstance();
						
						if (!plugin) {
							throw new Error('Plugin instance not available');
						}
						
						const obsidianTools = getObsidianTools();
						
						// Clear any previous live tool results when starting new tool execution
						usePluginStore.getState().clearLiveToolResults();
						
						const { toolResults, abortedDuringProcessing } = await processToolUseBlocks(
							toolUseBlocks,
							obsidianTools,
							signal,
							(toolId: string, updatedResult: ToolResultBlock) => {
								// Update the live tool results for real-time UI display
								usePluginStore.getState().updateLiveToolResult(toolId, updatedResult);
							}
						);

						if (abortedDuringProcessing || signal.aborted) {
							// Handle cleanup for aborted tool processing
							handleStreamAbortCleanup();
							currentTurnAborted = true;
							break; // Exit the while loop
						}

						// Add tool results message (as 'user' role for the next API call)
						const toolResultsMessage: Message = { role: "user", content: toolResults };
						usePluginStore.getState().addMessage(toolResultsMessage);
						// Continue the while loop
					} else {
						// No tool calls, this is the final message for this turn
						finalAssistantMessageForTTS = assistantMessage; // Store for potential TTS
						currentTurnAborted = true; // End the loop naturally
						break; // Exit the while loop
					}
				} else {
					console.warn("API call completed but no final content received.");
					// Remove the empty message from the conversation if it was added
					if (assistantMessage) {
						const currentMessages = usePluginStore.getState().chats.current.storedConversation.messages;
						const cleanedMessages = cleanupLastMessage(currentMessages);
						// Note: This would need message cleanup in the store
					}
					currentTurnAborted = true; // Treat as an issue, stop the loop
					break;
				}

			} catch (error) {
				// Catch errors from API/stream/tool handling
				
				// Handle cleanup for aborted requests
				handleStreamAbortCleanup();

				if (!(error instanceof APIUserAbortError)) {
					throw error;
				} else {
					currentTurnAborted = true; // Stop the loop on error or abort
					break; // Exit the while loop
				}
			}
		} // End of while loop

		return finalAssistantMessageForTTS;
	} finally {
		usePluginStore.getState().setIsGenerating(false);
		
		// Save immediately after generation completes (successful or aborted)
		usePluginStore.getState().saveImmediatelyIfNeeded(false);
		
		// Only clear live tool results if the turn completed successfully
		// If there were aborted tool calls, keep the live results to show their aborted status
		if (!currentTurnAborted && !signal.aborted) {
			usePluginStore.getState().clearLiveToolResults();
		}
	}
};

/**
 * Handles cleanup when a stream is aborted or encounters an error
 */
const handleStreamAbortCleanup = (): void => {
	const store = usePluginStore.getState();
	const messages = store.chats.current.storedConversation.messages;
	const lastMessage = messages[messages.length - 1];
	
	if (lastMessage?.role === "assistant") {
		const contentBlocks = Array.isArray(lastMessage.content) ? lastMessage.content : [];
		const hasIncompleteTools = hasIncompleteToolCalls(contentBlocks);
		const hasIncompleteThink = hasIncompleteThinking(contentBlocks);
		
		// Clear any thinking blocks that are still in progress to stop animation
		if (hasIncompleteThink) {
			const updatedContent = clearThinkingInProgress(contentBlocks);
			const updatedMessage = { ...lastMessage, content: updatedContent };
			store.updateMessage(messages.length - 1, updatedMessage);
		}
		
		// Mark any incomplete live tool results as complete to stop pulsing animation
		// This prevents the visual blinking when tool execution is aborted
		const toolUseBlocks = contentBlocks.filter(block => 
			typeof block === "object" && block !== null && "type" in block && block.type === "tool_use"
		);
		
		for (const toolBlock of toolUseBlocks) {
			// Check if this tool has an incomplete live result
			const toolId = (toolBlock as any).id;
			if (toolId) {
				// Force mark as complete with aborted status
				const abortedResult: ToolResultBlock = {
					type: "tool_result",
					tool_use_id: toolId,
					content: "❌ Operation aborted by user",
					is_error: true,
					is_complete: true,
					navigation_targets: []
				};
				store.updateLiveToolResult(toolId, abortedResult);
			}
		}
		
		if (hasIncompleteTools || hasIncompleteThink) {
			// Remove the incomplete message from conversation
			const cleanedMessages = cleanupLastMessage(messages);
			// Note: The store would need to handle this cleanup
		}
	}
}; 