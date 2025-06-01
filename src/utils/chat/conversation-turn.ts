import { Anthropic, APIUserAbortError } from "@anthropic-ai/sdk";
import { Notice } from "obsidian";
import { MessageCreateParamsStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import { Message, ContentBlock } from "./types";
import { formatMessagesForAPI } from "./api-formatting";
import { processAnthropicStream, StreamProcessorCallbacks } from "./stream-processor";
import { processToolUseBlocks } from "./tool-processing";
import { getToolUseBlocks, hasIncompleteToolCalls, hasIncompleteThinking, clearThinkingInProgress } from "./content-blocks";
import { cleanupLastMessage } from "./message-validation";
import { getPluginSettings } from "../../settings/PluginSettings";
import { getDefaultLNMode, resolveAutoModel } from "../mode/ln-mode-defaults";
import { t } from '../../i18n';
import type { ObsidianTool } from "../../obsidian-tools";

export interface ConversationTurnContext {
	// Message management
	messages: Message[];
	addMessage: (message: Message) => void;
	updateMessage: (message: Message) => void;
	
	// Mode and settings
	lnModesRef: React.MutableRefObject<Record<string, any>>;
	activeModeIdRef: React.MutableRefObject<string>;
	
	// Plugin reference for tools
	plugin: any;
	
	// State management
	setIsGeneratingResponse: (generating: boolean) => void;
	onConversationChange: () => void;
}

/**
 * Runs a complete conversation turn with the AI, handling tool calls and streaming
 */
export const runConversationTurn = async (
	systemPrompt: string,
	tools: ObsidianTool<any>[],
	signal: AbortSignal,
	context: ConversationTurnContext
): Promise<Message | null> => {
	// Manage loading state within this function
	context.setIsGeneratingResponse(true);
	let currentTurnAborted = false;
	let finalAssistantMessageForTTS: Message | null = null;

	try {
		// Outer try for the whole turn process
		while (!signal.aborted && !currentTurnAborted) {
			let assistantMessage: Message | null = null;

			try {
				const apiKey = getPluginSettings().anthropicApiKey;
				const anthropicClient = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

				const messagesForAPI = formatMessagesForAPI(context.messages);

				const defaultMode = getDefaultLNMode();

				// Get API parameters from active mode or defaults (using refs for current values)
				const currentActiveMode = context.lnModesRef.current[context.activeModeIdRef.current];
				const rawModel = currentActiveMode?.ln_model ?? defaultMode.ln_model;
				
				// Resolve "auto" model to actual model based on mode characteristics
				const model = rawModel === "auto" 
					? resolveAutoModel(currentActiveMode || defaultMode)
					: rawModel;
					
				const maxTokens = currentActiveMode.ln_max_tokens ?? defaultMode.ln_max_tokens;
				const thinkingBudgetTokens = currentActiveMode.ln_thinking_budget_tokens ?? defaultMode.ln_thinking_budget_tokens;

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

				const stream = await anthropicClient.messages.create(params, { signal: signal });

				// Set up stream processor callbacks
				const callbacks: StreamProcessorCallbacks = {
					onMessageStart: () => {
						assistantMessage = { role: "assistant", content: [] };
						context.addMessage(assistantMessage);
					},
					onMessageUpdate: (message: Message) => {
						assistantMessage = message;
						context.updateMessage(message);
					},
					onMessageStop: (finalMessage: Message) => {
						assistantMessage = finalMessage;
						context.onConversationChange();
					},
					onAbort: () => {
						currentTurnAborted = true;
					}
				};

				// Process the stream
				const turnResult = await processAnthropicStream(stream, signal, callbacks);

				if (turnResult.aborted || signal.aborted) {
					currentTurnAborted = true;
					break; // Exit the while loop
				}

				if (turnResult.finalContent && assistantMessage) {
					// Check for tool use
					const toolUseBlocks = getToolUseBlocks(turnResult.finalContent);

					if (toolUseBlocks.length > 0) {
						const { getObsidianTools } = await import("../../obsidian-tools");
						const obsidianTools = getObsidianTools(context.plugin);
						
						const { toolResults, abortedDuringProcessing } = await processToolUseBlocks(
							toolUseBlocks,
							obsidianTools,
							signal,
							(toolId: string, message: string) => {
								// Create progress update for UI - this could be handled better with a proper progress system
								console.log(`Tool Progress [${toolId}]: ${message}`);
								// TODO: Could add UI progress indicators here
							}
						);

						if (abortedDuringProcessing || signal.aborted) {
							currentTurnAborted = true;
							break; // Exit the while loop
						}

						// Add tool results message (as 'user' role for the next API call)
						const toolResultsMessage: Message = { role: "user", content: toolResults };
						context.addMessage(toolResultsMessage);
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
						const cleanedMessages = cleanupLastMessage(context.messages);
						// Update the conversation with cleaned messages
						// Note: This would need to be handled by the context
					}
					currentTurnAborted = true; // Treat as an issue, stop the loop
					break;
				}

			} catch (error) {
				// Catch errors from API/stream/tool handling
				if (error instanceof APIUserAbortError) {
					// Handle cleanup for aborted requests
					handleStreamAbortCleanup(context);
				} else {
					console.error("Error during conversation turn processing:", error);
					new Notice(t('errors.conversationTurn', { error: error instanceof Error ? error.message : "Unknown error" }));
					// Also clean up incomplete tool calls on error
					handleStreamAbortCleanup(context);
				}
				currentTurnAborted = true; // Stop the loop on error or abort
				break; // Exit the while loop
			}
		} // End of while loop

		return finalAssistantMessageForTTS;
	} finally {
		context.setIsGeneratingResponse(false);
	}
};

/**
 * Handles cleanup when a stream is aborted or encounters an error
 */
const handleStreamAbortCleanup = (context: ConversationTurnContext): void => {
	const lastMessage = context.messages[context.messages.length - 1];
	
	if (lastMessage?.role === "assistant") {
		const contentBlocks = Array.isArray(lastMessage.content) ? lastMessage.content : [];
		const hasIncompleteTools = hasIncompleteToolCalls(contentBlocks);
		const hasIncompleteThink = hasIncompleteThinking(contentBlocks);
		
		// Clear any thinking blocks that are still in progress to stop animation
		if (hasIncompleteThink) {
			const updatedContent = clearThinkingInProgress(contentBlocks);
			const updatedMessage = { ...lastMessage, content: updatedContent };
			context.updateMessage(updatedMessage);
		}
		
		if (hasIncompleteTools || hasIncompleteThink) {
			// Remove the incomplete message from conversation
			const cleanedMessages = cleanupLastMessage(context.messages);
			// Note: The context would need to handle this cleanup
		}
	}
}; 