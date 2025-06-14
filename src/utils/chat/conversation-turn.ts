import { Anthropic, APIUserAbortError } from "@anthropic-ai/sdk";
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
import { SystemPromptParts } from "../links/expand-links";
import { DEFAULT_MODE_ID } from '../modes/ln-mode-defaults';
import { validateChatMode } from '../modes/mode-validation';

/**
 * Runs a complete conversation turn with the AI, handling tool calls and streaming
 */
export const runConversationTurn = async (
	tools: ObsidianTool<Record<string, unknown>>[],
	signal: AbortSignal,
	chatId: string,
	chatModeId: string
): Promise<Message | null> => {
	const store = usePluginStore.getState();
	
	// Get the specific chat state first
	const chatState = store.getChatState(chatId);
	if (!chatState) {
		console.error(`Chat ${chatId} not found for conversation turn`);
		return null;
	}
	
	// Validate that modes are loaded and current mode exists
	const modeValidation = validateChatMode(chatId);
	if (!modeValidation.isValid) {
		console.error(`Cannot start conversation turn: ${modeValidation.reason}`);
		return null;
	}
	
	// Manage loading state for this specific chat
	store.setIsGenerating(chatId, true);
	let currentTurnAborted = false;
	let finalAssistantMessageForTTS: Message | null = null;

	// Clear any previous aborted tool results when starting a new turn
	store.clearLiveToolResults(chatId);

	// Track current mode for system prompt optimization - start with chat's mode or default
	let currentModeId: string = chatModeId || chatState.chat.storedConversation.modeId || DEFAULT_MODE_ID;
	let systemPrompt: SystemPromptParts = {
		staticSection: '',
		semiDynamicSection: '',
		dynamicSection: '',
		fullContent: ''
	};
	let systemPromptCalculated = false;

	try {
		// Get current messages array for this specific chat
		const messages = [...chatState.chat.storedConversation.messages];
		
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

				// Generate unique API call ID and track start time for cost tracking
				const apiCallId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				const apiCallStartTime = Date.now();

				// Create a stable reference to messages for API formatting from this specific chat
				const currentChatState = usePluginStore.getState().getChatState(chatId);
				if (!currentChatState) {
					console.error(`Chat ${chatId} not found during API formatting`);
					return null;
				}
				
				const currentMessages = [...currentChatState.chat.storedConversation.messages];
				const messagesForAPI = formatMessagesForAPI(currentMessages);

				const defaultMode = getDefaultLNMode();

				// Get API parameters from active mode or defaults
				const currentStore = usePluginStore.getState();
				const activeModeId = chatModeId || DEFAULT_MODE_ID;
				const currentActiveMode = currentStore.modes.available[activeModeId];
				
				// Only recalculate system prompt if mode changed or not yet calculated
				if (!systemPromptCalculated || currentModeId !== activeModeId) {
					currentModeId = activeModeId;
					
					// Generate system prompt
					systemPrompt = await currentStore.getSystemPrompt(currentModeId);
					
					systemPromptCalculated = true;
				}
				
				const rawModel = currentActiveMode?.model ?? defaultMode.model;
				
				// Resolve "auto" model to actual model based on mode characteristics
				const model = rawModel === "auto" 
					? resolveAutoModel(currentActiveMode || defaultMode)
					: rawModel;
					
				const maxTokens = currentActiveMode?.max_tokens ?? defaultMode.max_tokens;
				const thinkingBudgetTokens = currentActiveMode?.thinking_budget_tokens ?? defaultMode.thinking_budget_tokens;

				const cacheControlLong: Anthropic.Beta.Messages.BetaCacheControlEphemeral = {
					"type": "ephemeral",
					"ttl": "1h"
				}

				const cacheControlShort: Anthropic.Beta.Messages.BetaCacheControlEphemeral = {
					"type": "ephemeral"
				}

				const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
					...(systemPrompt.staticSection ? [{
						type: "text",
						text: systemPrompt.staticSection,
						"cache_control": cacheControlLong
					} as Anthropic.Messages.TextBlockParam] : []),
					...(systemPrompt.semiDynamicSection ? [{
						type: "text",
						text: systemPrompt.semiDynamicSection,
						"cache_control": cacheControlShort
					} as Anthropic.Messages.TextBlockParam] : []),
					...(systemPrompt.dynamicSection ? [{
						type: "text",
						text: systemPrompt.dynamicSection,
						cache_control: cacheControlShort
					} as Anthropic.Messages.TextBlockParam] : [])
				]

				const params: Anthropic.Beta.Messages.MessageCreateParams = {
					model: model,
					max_tokens: maxTokens,
					system: systemBlocks,
					stream: true,
					messages: messagesForAPI,
					tools: tools.map((tool, index) => ({
						...tool.specification as Anthropic.Messages.Tool,
						...(index === tools.length - 1 ? {
							"cache_control": cacheControlLong
						} : {}),
					})),
					thinking: {
						type: "enabled",
						budget_tokens: thinkingBudgetTokens,
					},
					betas: ["extended-cache-ttl-2025-04-11"]
				};

				console.debug("🔥 API Params:", params);

				const stream = await anthropicClient.beta.messages.create(params, { signal: signal });

				// Set up stream processor callbacks for this specific chat
				const callbacks: StreamProcessorCallbacks = {
					onMessageStart: () => {
						assistantMessage = { role: "assistant", content: [], modeId: currentModeId };
						usePluginStore.getState().addMessage(chatId, assistantMessage);
					},
					onMessageUpdate: (message: Message) => {
						// Validate message before updating
						if (!message || typeof message !== 'object') {
							console.warn("Invalid message in stream update, skipping");
							return;
						}
											// Ensure the modeId field is preserved during updates
					assistantMessage = { ...message, modeId: currentModeId };
						const currentStore = usePluginStore.getState();
						const currentChatState = currentStore.getChatState(chatId);
						if (currentChatState && currentChatState.chat.storedConversation.messages.length > 0) {
							currentStore.updateMessage(chatId, currentChatState.chat.storedConversation.messages.length - 1, assistantMessage);
						}
					},
					onMessageStop: (finalMessage: Message) => {
						// Validate final message
						if (!finalMessage || typeof finalMessage !== 'object') {
							console.warn("Invalid final message in stream stop, skipping");
							return;
						}
						// Ensure the modeId field is preserved in the final message
						assistantMessage = { ...finalMessage, modeId: currentModeId };
						
						// CRITICAL: Update the final message in the store before saving
						const currentStore = usePluginStore.getState();
						const currentChatState = currentStore.getChatState(chatId);
						if (currentChatState && currentChatState.chat.storedConversation.messages.length > 0) {
							currentStore.updateMessage(chatId, currentChatState.chat.storedConversation.messages.length - 1, assistantMessage);
						}
						
						usePluginStore.getState().saveConversation(chatId);
					},
					onAbort: () => {
						currentTurnAborted = true;
					},
					onUsageData: (usage) => {
						// Calculate and store cost data when usage information is received
						const apiCallDuration = Date.now() - apiCallStartTime;
						const store = usePluginStore.getState();
						store.updateCostEntry(chatId, model, usage, apiCallStartTime, apiCallDuration, apiCallId);
					}
				};

				// Process the stream
				const turnResult = await processAnthropicStream(stream, signal, callbacks);

				if (turnResult.aborted || signal.aborted) {
					// Handle cleanup for aborted stream
					handleStreamAbortCleanup(chatId);
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
						usePluginStore.getState().clearLiveToolResults(chatId);
						
						const { toolResults, abortedDuringProcessing } = await processToolUseBlocks(
							toolUseBlocks,
							obsidianTools,
							signal,
							chatId,
							(toolId: string, updatedResult: ToolResultBlock) => {
								// Update the live tool results for real-time UI display for this specific chat
								usePluginStore.getState().updateLiveToolResult(chatId, toolId, updatedResult);
							}
						);

						if (abortedDuringProcessing || signal.aborted) {
							// Handle cleanup for aborted tool processing
							handleStreamAbortCleanup(chatId);
							currentTurnAborted = true;
							break; // Exit the while loop
						}

						// Add tool results message (as 'user' role for the next API call)
						const toolResultsMessage: Message = { role: "user", content: toolResults };
						usePluginStore.getState().addMessage(chatId, toolResultsMessage);
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
						const currentChatState = usePluginStore.getState().getChatState(chatId);
						if (currentChatState) {
							const currentMessages = currentChatState.chat.storedConversation.messages;
							const cleanedMessages = cleanupLastMessage(currentMessages);
							// Note: This would need message cleanup in the store
						}
					}
					currentTurnAborted = true; // Treat as an issue, stop the loop
					break;
				}

			} catch (error) {
				// Catch errors from API/stream/tool handling
				
				// Handle cleanup for aborted requests
				handleStreamAbortCleanup(chatId);

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
		usePluginStore.getState().setIsGenerating(chatId, false);
		
		// Save immediately after generation completes (successful or aborted) for this specific chat
		usePluginStore.getState().saveImmediatelyIfNeeded(chatId, false);
		
		// Only clear live tool results if the turn completed successfully
		// If there were aborted tool calls, keep the live results to show their aborted status
		if (!currentTurnAborted && !signal.aborted) {
			usePluginStore.getState().clearLiveToolResults(chatId);
		}
	}
};

/**
 * Handles cleanup when a stream is aborted or encounters an error
 */
const handleStreamAbortCleanup = (chatId: string): void => {
	const store = usePluginStore.getState();
	const chatState = store.getChatState(chatId);
	if (!chatState) return;
	
	const messages = chatState.chat.storedConversation.messages;
	const lastMessage = messages[messages.length - 1];
	
	if (lastMessage?.role === "assistant") {
		const contentBlocks = Array.isArray(lastMessage.content) ? lastMessage.content : [];
		const hasIncompleteTools = hasIncompleteToolCalls(contentBlocks);
		const hasIncompleteThink = hasIncompleteThinking(contentBlocks);
		
		// Clear any thinking blocks that are still in progress to stop animation
		if (hasIncompleteThink) {
			const updatedContent = clearThinkingInProgress(contentBlocks);
			const updatedMessage = { ...lastMessage, content: updatedContent };
			store.updateMessage(chatId, messages.length - 1, updatedMessage);
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
				store.updateLiveToolResult(chatId, toolId, abortedResult);
			}
		}
		
		if (hasIncompleteTools || hasIncompleteThink) {
			// Remove the incomplete message from conversation
			const cleanedMessages = cleanupLastMessage(messages);
			// Note: The store would need to handle this cleanup
		}
	}
}; 