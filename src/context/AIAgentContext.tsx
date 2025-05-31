import React, {
	createContext,
	useContext,
	useState,
	ReactNode,
	useCallback,
	useRef,
} from "react";
import { Anthropic, APIUserAbortError } from "@anthropic-ai/sdk";
import { getPluginSettings } from "../settings/PluginSettings";
import { getObsidianTools, ObsidianTool, NavigationTarget } from "../obsidian-tools";
import { Notice } from "obsidian";
import type MyPlugin from "../main";
import { useTextToSpeech } from "./TextToSpeechContext";
import { useSpeechToText } from "./SpeechToTextContext";
import {
	Message,
	ContentBlock,
	TextBlock,
	ThinkingBlock,
	RedactedThinkingBlock,
	ToolUseBlock,
	ToolResultBlock,
} from "src/types/types";
import { useLNMode } from "./LNModeContext";
import { MessageCreateParamsStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import { t } from '../i18n';
import { getDefaultLNMode, resolveAutoModel } from "src/defaults/ln-mode-defaults";
import { ContextCollector } from "src/context-collector";

export interface AIAgentContextType {
	conversation: Message[];
	clearConversation: () => void;
	addUserMessage: (userMessage: string, signal: AbortSignal, images?: any[]) => Promise<void>;
	editUserMessage: (messageIndex: number, newContent: string, signal: AbortSignal, images?: any[]) => Promise<void>;
	getContext: () => Promise<string>;
	reset: () => void;
	isGeneratingResponse: boolean;
	editingMessage: { index: number; content: string; images?: any[] } | null;
	startEditingMessage: (messageIndex: number) => void;
	cancelEditingMessage: () => void;
}

const AIAgentContext = createContext<AIAgentContextType | undefined>(undefined);

// Define the type for the stream parameter
type AnthropicMessageStream =
	AsyncIterable<Anthropic.Messages.MessageStreamEvent>;

// Function to ensure content is always ContentBlock[]
const ensureContentBlocks = (
	content: string | ContentBlock[] | undefined,
): ContentBlock[] => {
	if (typeof content === "string") {
		return [{ type: "text", text: content }];
	}
	if (Array.isArray(content)) {
		// Filter out any non-ContentBlock items just in case
		return content.filter(
			(item) =>
				typeof item === "object" && item !== null && "type" in item,
		) as ContentBlock[];
	}
	return []; // Return empty array for undefined or other types
};

export const AIAgentProvider: React.FC<{
	children?: ReactNode;
	plugin: MyPlugin;
}> = ({ children, plugin }) => {
	const conversationRef = useRef<Message[]>([]);
	const partialJsonRef = useRef<Record<number, string>>({});
	const [forceUpdate, setForceUpdate] = useState(0);
	const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
	const [editingMessage, setEditingMessage] = useState<{ index: number; content: string; images?: any[] } | null>(null);
	const textToSpeech = useTextToSpeech();
	const { isRecording } = useSpeechToText();
	const { activeModeIdRef, lnModesRef } = useLNMode();
	const app = plugin.app;
	const clearConversation = useCallback(() => {
		conversationRef.current = [];
		navigationTargetsRef.current.clear();
		setForceUpdate((prev) => prev + 1);
	}, []);

	// Store navigationTargets separately since they can't be sent to the Claude API
	const navigationTargetsRef = useRef<Map<string, NavigationTarget[]>>(new Map());

	const addUserOrToolResultMessage = useCallback(
		(role: "user" | "assistant", content: string | ContentBlock[]) => {
			// Ensure content is always ContentBlock[]
			let contentBlocks: ContentBlock[] =
				typeof content === "string"
					? [{ type: "text", text: content }]
					: ensureContentBlocks(content);
			
			// If this is a user message with tool results, add navigationTargets from our ref
			if (role === "user" && Array.isArray(content)) {
				contentBlocks = contentBlocks.map(block => {
					if (block.type === "tool_result") {
						const navigationTargets = navigationTargetsRef.current.get(block.tool_use_id);
						return {
							...block,
							navigationTargets
						} as ToolResultBlock;
					}
					return block;
				});
			}
			
			const newMessage: Message = { role, content: contentBlocks };
			
			// For assistant messages, ensure we update correctly to avoid duplicates when rebuilding conversation
			if (role === "assistant") {
				// Check if this is a continuation of an existing assistant message
				const lastMessage = conversationRef.current[conversationRef.current.length - 1];
				if (lastMessage && lastMessage.role === "assistant") {
					// Update the existing message instead of adding a new one
					lastMessage.content = contentBlocks;
					setForceUpdate((prev) => prev + 1);
					return;
				}
			}
			
			conversationRef.current = [...conversationRef.current, newMessage];
			setForceUpdate((prev) => prev + 1);
		},
		[],
	);
	const getContext = useCallback(async (): Promise<string> => {
		const currentActiveMode = lnModesRef.current[activeModeIdRef.current];
		return (await new ContextCollector(app).expandLinks(currentActiveMode.ln_system_prompt)).trim();
	}, [lnModesRef, activeModeIdRef, app]);

	const extractTextForTTS = useCallback(
		(contentBlocks: ContentBlock[]): string => {
			return contentBlocks
				.filter((block): block is TextBlock => block.type === "text")
				.map((block) => block.text)
				.join(" ");
		},
		[],
	);

	// Format messages, ensuring content is always ContentBlock[] compatible with API
	const formatMessagesForAPI = useCallback(
		(messages: Message[]): Anthropic.Messages.MessageParam[] => {
			// First, validate and clean the messages to handle incomplete tool calls
			const validatedMessages = validateAndCleanMessages(messages);
			
			return validatedMessages.map((msg) => {
				let apiContent: Anthropic.Messages.MessageParam["content"];
				const contentBlocks = ensureContentBlocks(msg.content); // Ensure array of blocks

				apiContent = contentBlocks.map((block) => {
					if (block.type === "tool_result") {
						return {
							type: "tool_result",
							tool_use_id: block.tool_use_id,
							content: block.content, // Assuming content is string for now
							is_error: block.is_error, // Pass error flag
						} as Anthropic.ToolResultBlockParam;
					}

					// Clean up properties that Anthropic API doesn't expect
					if (block.type === "thinking") {
						/* trunk-ignore(eslint/@typescript-eslint/no-unused-vars) */
						const { reasoningInProgress, ...cleanedBlock } = block;
						return cleanedBlock;
					}

					// For other blocks, pass them through
					return block as any;
				});

				// Handle case where content was empty/invalid
				if (!apiContent || apiContent.length === 0) {
					apiContent = [{ type: "text", text: "" }]; // Send empty text block if needed
				}

				return {
					role: msg.role,
					content: apiContent,
				};
			});
		},
		[],
	);

	// Function to validate and clean messages to prevent incomplete tool call issues
	const validateAndCleanMessages = useCallback((messages: Message[]): Message[] => {
		const cleanedMessages: Message[] = [];
		
		for (let i = 0; i < messages.length; i++) {
			const currentMessage = messages[i];
			
			// If this is an assistant message, check for tool_use blocks
			if (currentMessage.role === "assistant") {
				const contentBlocks = ensureContentBlocks(currentMessage.content);
				const toolUseBlocks = contentBlocks.filter(block => block.type === "tool_use");
				
				if (toolUseBlocks.length > 0) {
					// This assistant message contains tool calls
					// Check if the next message contains corresponding tool_result blocks
					const nextMessage = messages[i + 1];
					
					if (!nextMessage || nextMessage.role !== "user") {
						// No next message or next message is not a user message
						// This means we have incomplete tool calls - exclude this message
						console.warn(`Excluding assistant message with incomplete tool calls at index ${i}`);
						console.warn("Tool use blocks found:", toolUseBlocks.map(block => ({ id: block.id, name: block.name })));
						break; // Stop processing here to avoid incomplete conversation
					}
					
					// Check if all tool_use blocks have corresponding tool_result blocks
					const nextContentBlocks = ensureContentBlocks(nextMessage.content);
					const toolResultBlocks = nextContentBlocks.filter(block => block.type === "tool_result");
					
					const toolUseIds = new Set(toolUseBlocks.map(block => block.id));
					const toolResultIds = new Set(toolResultBlocks.map(block => block.tool_use_id));
					
					// Check if all tool_use IDs have corresponding tool_result IDs
					const missingResults = [...toolUseIds].filter(id => !toolResultIds.has(id));
					
					if (missingResults.length > 0) {
						console.warn(`Excluding assistant message with missing tool results at index ${i}`);
						console.warn("Missing tool result IDs:", missingResults);
						break; // Stop processing here to avoid incomplete conversation
					}
				}
			}
			
			cleanedMessages.push(currentMessage);
		}
		
		return cleanedMessages;
	}, []);

	// Function to clean up incomplete tool calls from the conversation
	const cleanupIncompleteToolCalls = useCallback(() => {
		const currentConversation = conversationRef.current;
		if (currentConversation.length === 0) return;
		
		// Check the last message
		const lastMessage = currentConversation[currentConversation.length - 1];
		
		if (lastMessage.role === "assistant") {
			const contentBlocks = ensureContentBlocks(lastMessage.content);
			const toolUseBlocks = contentBlocks.filter(block => block.type === "tool_use");
			
			if (toolUseBlocks.length > 0) {
				// The last assistant message has tool calls but likely no results
				// Remove this incomplete message
				console.log("Cleaning up incomplete tool calls from last assistant message");
				conversationRef.current = currentConversation.slice(0, -1);
				setForceUpdate((prev) => prev + 1);
				
				// Show user feedback about the cleanup
				new Notice(t('errors.incompleteToolCall') || "Incomplete tool call removed due to interruption");
			}
		}
	}, []);

	// Modify this function to work with streaming directly to the conversation
	const processAnthropicStream = async (
		stream: AnthropicMessageStream,
		signal: AbortSignal,
	): Promise<{ aborted: boolean; finalContent: ContentBlock[] | null }> => {
		let aborted = false;
		let finalContent: ContentBlock[] = [];
		let localMessage: Message | null = null;
		let thinkingBlocksInProgress: Record<number, boolean> = {}; // Track thinking blocks in progress

		try {
			for await (const chunk of stream) {
				if (signal.aborted) {
					aborted = true;
					break;
				}

				switch (chunk.type) {
					case "message_start":
						localMessage = { role: "assistant", content: [] };
						finalContent = [];
						thinkingBlocksInProgress = {}; // Reset on new message
						// Add message to conversation directly
						conversationRef.current = [
							...conversationRef.current,
							localMessage,
						];
						setForceUpdate((prev) => prev + 1);
						break;

					case "content_block_start": {
						// Initialize message if needed
						if (!localMessage) {
							localMessage = { role: "assistant", content: [] };
							finalContent = [];
							conversationRef.current = [
								...conversationRef.current,
								localMessage,
							];
							setForceUpdate((prev) => prev + 1);
						}

						const blockIndex = chunk.index;
						const blockType = chunk.content_block?.type;
						const currentContent = ensureContentBlocks(
							localMessage.content,
						);

						// Initialize JSON accumulator for tool_use blocks
						if (
							blockType === "tool_use" &&
							partialJsonRef.current
						) {
							partialJsonRef.current[blockIndex] = "";
						}

						// Mark thinking blocks as in progress
						if (blockType === "thinking") {
							thinkingBlocksInProgress[blockIndex] = true;
						}

						// Prepare new content array
						const newContent = [...currentContent];
						while (newContent.length <= blockIndex) {
							newContent.push({ type: "text", text: "" });
						}

						// Set the block with appropriate type
						if (blockType === "text") {
							newContent[blockIndex] = { type: "text", text: "" };
						} else if (blockType === "thinking") {
							newContent[blockIndex] = {
								type: "thinking",
								thinking: "",
								reasoningInProgress: true, // Mark as in progress initially
							};
						} else if (
							blockType === "redacted_thinking" &&
							chunk.content_block?.data
						) {
							newContent[blockIndex] = {
								type: "redacted_thinking",
								data: chunk.content_block.data,
							} as RedactedThinkingBlock;
						} else if (
							blockType === "tool_use" &&
							chunk.content_block
						) {
							newContent[blockIndex] = {
								type: "tool_use",
								id: chunk.content_block.id,
								name: chunk.content_block.name,
								input: {},
							} as ToolUseBlock;
						}

						if (localMessage) {
							finalContent = newContent;
							localMessage.content = newContent;
							setForceUpdate((prev) => prev + 1);
						}
						break;
					}
					case "content_block_delta": {
						if (!localMessage) continue;

						const deltaIndex = chunk.index;
						const content = ensureContentBlocks(
							localMessage.content,
						);
						if (deltaIndex >= content.length) continue;

						const contentBlock = content[deltaIndex];
						if (!contentBlock) continue;

						const updatedContent = [...content];
						const delta = chunk.delta;

						// Handle different delta types
						if (
							delta.type === "text_delta" &&
							contentBlock.type === "text"
						) {
							updatedContent[deltaIndex] = {
								...contentBlock,
								text: contentBlock.text + delta.text,
							};
						} else if (
							delta.type === "thinking_delta" &&
							contentBlock.type === "thinking"
						) {
							updatedContent[deltaIndex] = {
								...contentBlock,
								thinking:
									contentBlock.thinking + delta.thinking,
								reasoningInProgress: true, // Still in progress while receiving deltas
							};
						} else if (
							delta.type === "signature_delta" &&
							contentBlock.type === "thinking"
						) {
							updatedContent[deltaIndex] = {
								...contentBlock,
								signature:
									(contentBlock.signature || "") +
									delta.signature,
							};
						} else if (
							delta.type === "input_json_delta" &&
							contentBlock.type === "tool_use" &&
							partialJsonRef.current
						) {
							partialJsonRef.current[deltaIndex] =
								(partialJsonRef.current[deltaIndex] || "") +
								delta.partial_json;
						}

						finalContent = updatedContent;
						localMessage.content = updatedContent;
						setForceUpdate((prev) => prev + 1);
						break;
					}
					case "content_block_stop": {
						if (!localMessage) break;

						const stopIndex = chunk.index;

						// If this is a thinking block, mark it as completed
						if (
							thinkingBlocksInProgress[stopIndex] &&
							localMessage.content.length > stopIndex
						) {
							const block = localMessage.content[stopIndex];
							if (
								typeof block === "object" &&
								block.type === "thinking"
							) {
								const contentCopy = ensureContentBlocks(
									localMessage.content,
								);
								contentCopy[stopIndex] = {
									...(contentCopy[
										stopIndex
									] as ThinkingBlock),
									reasoningInProgress: false,
								};
								finalContent = contentCopy;
								localMessage.content = contentCopy;
								delete thinkingBlocksInProgress[stopIndex]; // Remove from tracking
								setForceUpdate((prev) => prev + 1);
							}
						}

						// Process JSON for tool_use blocks
						const jsonString = partialJsonRef.current?.[stopIndex];
						if (
							jsonString &&
							localMessage.content.length > stopIndex
						) {
							const block = localMessage.content[stopIndex];
							if (
								typeof block === "object" &&
								block.type === "tool_use"
							) {
								try {
									if (
										jsonString.trim().startsWith("{") &&
										jsonString.trim().endsWith("}")
									) {
										const contentCopy = ensureContentBlocks(
											localMessage.content,
										);
										const toolBlock = {
											...contentCopy[stopIndex],
										} as ToolUseBlock;
										toolBlock.input =
											JSON.parse(jsonString);
										contentCopy[stopIndex] = toolBlock;
										finalContent = contentCopy;
										localMessage.content = contentCopy;
										setForceUpdate((prev) => prev + 1);
									}
								} catch (e) {
									console.error(
										`JSON parse error for block ${stopIndex}`,
									);
								}
							}
						}

						// Clean up reference
						if (partialJsonRef.current) {
							delete partialJsonRef.current[stopIndex];
						}
						break;
					}
					case "message_stop":
						// Clear all thinking blocks in progress flags when message ends
						if (localMessage) {
							const finalContentCopy = ensureContentBlocks(
								localMessage.content,
							);
							let hasChanges = false;

							finalContentCopy.forEach((block, idx) => {
								if (
									block.type === "thinking" &&
									thinkingBlocksInProgress[idx]
								) {
									(
										finalContentCopy[idx] as ThinkingBlock
									).reasoningInProgress = false;
									delete thinkingBlocksInProgress[idx];
									hasChanges = true;
								}
							});

							if (hasChanges) {
								finalContent = finalContentCopy;
								localMessage.content = finalContentCopy;
								setForceUpdate((prev) => prev + 1);
							}
						}

						thinkingBlocksInProgress = {};
						if (partialJsonRef.current) {
							partialJsonRef.current = {};
						}
						break;
				}
			}
		} catch (error) {
			console.error("Error processing Anthropic stream:", error);
			aborted = true;
			
			// If aborted and we have a partial message with incomplete tool calls, remove it
			if (aborted && localMessage) {
				const contentBlocks = ensureContentBlocks(localMessage.content);
				const hasIncompleteToolCalls = contentBlocks.some(block => 
					block.type === "tool_use" && (!block.input || Object.keys(block.input).length === 0)
				);
				
				if (hasIncompleteToolCalls) {
					console.log("Removing assistant message with incomplete tool calls due to abort");
					// Remove the incomplete message from conversation
					conversationRef.current = conversationRef.current.slice(0, -1);
					setForceUpdate((prev) => prev + 1);
				}
			}
		}

		return {
			aborted,
			finalContent: finalContent.length > 0 ? finalContent : null,
		};
	};

	const runConversationTurn = useCallback(
		async (
			systemPrompt: string,
			tools: ObsidianTool<any>[],
			signal: AbortSignal,
		): Promise<Message | null> => {
			// Manage loading state within this function
			setIsGeneratingResponse(true);
			let currentTurnAborted = false;
			let finalAssistantMessageForTTS: Message | null = null;

			try {
				// Outer try for the whole turn process
				while (!signal.aborted && !currentTurnAborted) {
					let turnResult: {
						aborted: boolean;
						finalContent: ContentBlock[] | null;
					} = { aborted: false, finalContent: null };
					let assistantMessage: Message | null = null;

					try {
						const apiKey = getPluginSettings().anthropicApiKey;
						const anthropicClient = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

						const currentHistory = conversationRef.current;
						const messagesForAPI =
							formatMessagesForAPI(currentHistory);

						const defaultMode = getDefaultLNMode();

						// Get API parameters from active mode or defaults (using refs for current values)
						const currentActiveMode = lnModesRef.current[activeModeIdRef.current];
						const rawModel = currentActiveMode?.ln_model ?? defaultMode.ln_model;
						
						// Resolve "auto" model to actual model based on mode characteristics
						const model = rawModel === "auto" 
							? resolveAutoModel(currentActiveMode || defaultMode)
							: rawModel;
							
						const maxTokens =
							currentActiveMode.ln_max_tokens ??
							defaultMode.ln_max_tokens;
						const thinkingBudgetTokens =
							currentActiveMode.ln_thinking_budget_tokens ??
							defaultMode.ln_thinking_budget_tokens;

						

						const params: MessageCreateParamsStreaming = {
							model: model,
							max_tokens: maxTokens,
							system: systemPrompt,
							stream: true,
							messages: messagesForAPI,
							tools: tools.map(
								(tool) =>
									tool.specification as Anthropic.Messages.Tool,
							),
							thinking: {
								type: "enabled",
								budget_tokens: thinkingBudgetTokens,
							},
						};

						console.log(
							`🔄 Making API call (${model}) with parameters:`,
						);
						console.log("API parameters:", params);

						const stream = await anthropicClient.messages.create(
							params,
							{ signal: signal },
						);

						// Process the stream
						turnResult = await processAnthropicStream(
							stream,
							signal,
						);

						if (turnResult.aborted || signal.aborted) {
							console.log(
								"API call or stream processing aborted.",
							);
							currentTurnAborted = true;
							break; // Exit the while loop
						}

						if (turnResult.finalContent) {
							// The message is already in the conversation, don't add it again
							// Just get a reference to it for TTS
							assistantMessage =
								conversationRef.current[
									conversationRef.current.length - 1
								];
							console.log(
								"API response received:",
								assistantMessage,
							);
						} else {
							console.warn(
								"API call completed but no final content received.",
							);
							// Remove the empty message from the conversation
							conversationRef.current = conversationRef.current.slice(0, -1);
							setForceUpdate((prev) => prev + 1);
							currentTurnAborted = true; // Treat as an issue, stop the loop
							break;
						}

						// Check for tool use
						const toolUseBlocks = (
							assistantMessage.content as ContentBlock[]
						).filter(
							(block): block is ToolUseBlock =>
								block.type === "tool_use",
						);

						if (toolUseBlocks.length > 0) {
							console.log(
								`🛠️ ${toolUseBlocks.length} tool call(s) detected. Processing...`,
							);
							const toolResults: ToolResultBlock[] = [];
							let abortedDuringToolProcessing = false;

							for (const toolUseBlock of toolUseBlocks) {
								if (signal.aborted) {
									abortedDuringToolProcessing = true;
									break;
								}
								try {
									const result = await getObsidianTools(
										plugin,
									).processToolCall(
										toolUseBlock.name,
										toolUseBlock.input,
									);
									
									// Store navigationTargets separately for UI use
									if (result.navigationTargets) {
										navigationTargetsRef.current.set(toolUseBlock.id, result.navigationTargets);
									}
									
									toolResults.push({
										type: "tool_result",
										tool_use_id: toolUseBlock.id,
										content: result.result,
										is_error: result.isError
									});
								} catch (error: any) {
									toolResults.push({
										type: "tool_result",
										tool_use_id: toolUseBlock.id,
										content: `Error: ${error.message || "Unknown error"}`,
										is_error: true,
									});
								}
							}

							if (abortedDuringToolProcessing || signal.aborted) {
								console.log("Tool processing aborted.");
								currentTurnAborted = true;
								break; // Exit the while loop
							}

							// Add tool results message (as 'user' role for the next API call)
							addUserOrToolResultMessage("user", toolResults);
							console.log(
								"Tool results added to conversation. Looping back for next API call.",
							);
							// Continue the while loop
						} else {
							// No tool calls, this is the final message for this turn
							console.log(
								"✅ No tool calls detected. Turn complete.",
							);
							finalAssistantMessageForTTS = assistantMessage; // Store for potential TTS
							currentTurnAborted = true; // End the loop naturally
							break; // Exit the while loop
						}
					} catch (error) {
						// Catch errors from API/stream/tool handling
						if (error instanceof APIUserAbortError) {
							console.log("Conversation turn aborted by user.");
							// Clean up any incomplete tool calls that may have been partially generated
							cleanupIncompleteToolCalls();
						} else {
							console.error(
								"Error during conversation turn processing:",
								error,
							);
							new Notice(
								t('errors.conversationTurn', { error: error instanceof Error ? error.message : "Unknown error" })
							);
							// Also clean up incomplete tool calls on error
							cleanupIncompleteToolCalls();
						}
						currentTurnAborted = true; // Stop the loop on error or abort
						break; // Exit the while loop
					}
				} // End of while loop

				// --- Post-Loop Actions ---
				console.log(
					"Generation completed, UI updated to reflect completion.",
				);

				return finalAssistantMessageForTTS;
			} finally {
				setIsGeneratingResponse(false);
				console.log("runConversationTurn finished.");
			}
		},
		[
			formatMessagesForAPI,
			processAnthropicStream,
			plugin,
			addUserOrToolResultMessage,
			lnModesRef,
			activeModeIdRef,
			cleanupIncompleteToolCalls,
		],
	);

	const handleTTS = useCallback(
		async (
			finalAssistantMessageForTTS: Message | null,
			signal: AbortSignal,
		) => {
			if (!finalAssistantMessageForTTS) return;
			
			// Skip automatic TTS if recording is active
			if (isRecording) {
				console.log("🚫 Skipping automatic TTS because recording is active");
				return;
			}
			
			const textForTTS = extractTextForTTS(
				finalAssistantMessageForTTS.content as ContentBlock[],
			);
			
			// Use refs to get current mode instead of captured activeMode
			const defaultMode = getDefaultLNMode();
			const currentActiveMode = lnModesRef.current[activeModeIdRef.current];
			const autoplayEnabled = currentActiveMode?.ln_voice_autoplay || defaultMode.ln_voice_autoplay;
			
			// Only auto-play if both the global setting and the mode-specific autoplay are enabled
			if (autoplayEnabled && textForTTS.trim().length > 0) {
				console.log(
					"🗣️ Starting TTS after generation has completed...",
				);
				try {
					await textToSpeech.speakText(textForTTS, signal);
					if (signal.aborted) {
						console.log("TTS aborted.");
					} else {
						console.log("TTS finished.");
					}
				} catch (ttsError) {
					console.error("Error during TTS:", ttsError);
				}
			}
		},
		[extractTextForTTS, textToSpeech, lnModesRef, activeModeIdRef, isRecording],
	);

	const addUserMessage = useCallback(
		async (userMessage: string, signal: AbortSignal, images?: any[]): Promise<void> => {
			try {
				// Create content with text and optional images
				let contentBlocks: ContentBlock[] = [];
				
				// Add text block if the message isn't empty
				if (userMessage.trim() !== '') {
					contentBlocks.push({ type: "text", text: userMessage });
				}
				
				// Add image blocks if provided
				if (images && images.length > 0) {
					contentBlocks = [...contentBlocks, ...images];
				}
				
				// Add user message to the conversation immediately
				if (contentBlocks.length > 0) {
					const newMessage: Message = { role: "user", content: contentBlocks };
					conversationRef.current = [...conversationRef.current, newMessage];
					setForceUpdate((prev) => prev + 1);
					setIsGeneratingResponse(true);

					try {
						// Prepare context, prompt, and tools
						const systemPrompt = await getContext();
						const obsidianTools = getObsidianTools(plugin);
						
						// Get current mode for tool filtering
						const currentActiveMode = lnModesRef.current[activeModeIdRef.current];
						const tools = currentActiveMode 
							? obsidianTools.getToolsForMode(currentActiveMode) 
							: obsidianTools.getTools();

						console.log(
							`🚀 Triggering conversation turn for user message with ${images?.length || 0} images`,
						);
						console.log(currentActiveMode.ln_tools_allowed, currentActiveMode.ln_tools_disallowed)
						console.log(`🔧 Using ${tools.length} tools for mode: ${currentActiveMode?.ln_name || 'default'}`);

						// Call the core loop function - it now handles its own loading state
						const finalAssistantMessageForTTS =
							await runConversationTurn(systemPrompt, tools, signal);
						await handleTTS(finalAssistantMessageForTTS, signal);

						// Logging completion or abortion status after the turn finishes
						if (signal.aborted) {
							console.log("User message processing was aborted.");
						} else {
							console.log("User message processing finished.");
						}
					} catch (error) {
						// This catch block now primarily handles errors *before* runConversationTurn starts
						// (e.g., getContext error, getObsidianTools error)
						// Errors *during* the conversation turn are handled within runConversationTurn.
						console.error(
							"Error preparing or initiating conversation turn:",
							error,
						);
						// Avoid duplicate notices if runConversationTurn already showed one
						if (!(error instanceof APIUserAbortError)) {
							new Notice(t('errors.setup', { error: error instanceof Error ? error.message : "Unknown error" }));
						}
						// *** Ensure loading state is reset if setup fails ***
						setIsGeneratingResponse(false);
					}
				}
				// *** Removed finally block - cleanup is handled within runConversationTurn's finally ***
				console.log("addUserMessage function finished.");
			} catch (error) {
				// This catch block now primarily handles errors *before* runConversationTurn starts
				// (e.g., getContext error, getObsidianTools error)
				// Errors *during* the conversation turn are handled within runConversationTurn.
				console.error(
					"Error preparing or initiating conversation turn:",
					error,
				);
				// Avoid duplicate notices if runConversationTurn already showed one
				if (!(error instanceof APIUserAbortError)) {
					new Notice(t('errors.setup', { error: error instanceof Error ? error.message : "Unknown error" }));
				}
				// *** Ensure loading state is reset if setup fails ***
				setIsGeneratingResponse(false);
			}
			// *** Removed finally block - cleanup is handled within runConversationTurn's finally ***
			console.log("addUserMessage function finished.");
		},
		[
			getContext,
			plugin,
			runConversationTurn,
			handleTTS, // Dependencies
			lnModesRef,
			activeModeIdRef,
		],
	);

	const editUserMessage = useCallback(
		async (messageIndex: number, newContent: string, signal: AbortSignal, images?: any[]): Promise<void> => {
			// Check if index is valid and is a user message
			if (messageIndex < 0 || messageIndex >= conversationRef.current.length) {
				console.error(`Invalid message index for editing: ${messageIndex}. Conversation length: ${conversationRef.current.length}`);
				return;
			}

			const targetMessage = conversationRef.current[messageIndex];
			if (targetMessage.role !== "user") {
				console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
				console.error("Current conversation:", conversationRef.current.map((msg, idx) => ({ index: idx, role: msg.role })));
				return;
			}

			// If currently generating, abort first
			if (isGeneratingResponse) {
				console.log("Aborting current generation before editing message");
				setIsGeneratingResponse(false);
			}

			console.log(`Editing user message at index ${messageIndex} with new content: "${newContent}"`);

			// Create a copy of the conversation up to the edited message
			const conversationUpToEdit = conversationRef.current.slice(0, messageIndex + 1);
			
			// Create the new content blocks
			const newContentBlocks: any[] = [];
			
			// Add text content if provided
			if (newContent.trim()) {
				newContentBlocks.push({ type: "text", text: newContent });
			}
			
			// Add images if provided
			if (images && images.length > 0) {
				images.forEach((img) => {
					// Check if this is already in API format (from editing mode)
					if (img.type === "image" && img.source) {
						newContentBlocks.push(img);
					} else {
						// Handle AttachedImage format (with src property)
						newContentBlocks.push({
							type: "image",
							source: {
								type: "base64",
								media_type: img.src.split(";")[0].split(":")[1], // Extract MIME type
								data: img.src.split(",")[1], // Extract base64 data without the prefix
							},
						});
					}
				});
			}
			
			// Update the edited message with new content
			conversationUpToEdit[messageIndex] = {
				role: "user",
				content: newContentBlocks
			};
			
			// Replace the entire conversation reference with the truncated version
			conversationRef.current = conversationUpToEdit;
			setForceUpdate(prev => prev + 1);
			
			// Clear editing state
			setEditingMessage(null);

			// Trigger a new AI conversation turn from this point
			if (newContentBlocks.length > 0) {
				console.log("Triggering AI response after message edit");
				
				try {
					// Set generating state
					setIsGeneratingResponse(true);

					// Prepare context, prompt, and tools
					const systemPrompt = await getContext();
					const obsidianTools = getObsidianTools(plugin);
					
					// Get current mode for tool filtering
					const currentActiveMode = lnModesRef.current[activeModeIdRef.current];
					const tools = currentActiveMode 
						? obsidianTools.getToolsForMode(currentActiveMode) 
						: obsidianTools.getTools();

					console.log(`🚀 Triggering conversation turn after edit`);
					console.log(`🔧 Using ${tools.length} tools for mode: ${currentActiveMode?.ln_name || 'default'}`);

					// Call the core loop function
					const finalAssistantMessageForTTS = await runConversationTurn(systemPrompt, tools, signal);
					await handleTTS(finalAssistantMessageForTTS, signal);

					// Logging completion or abortion status after the turn finishes
					if (signal.aborted) {
						console.log("Message edit processing was aborted.");
					} else {
						console.log("Message edit processing finished.");
					}
				} catch (error) {
					console.error("Error processing conversation after edit:", error);
					setIsGeneratingResponse(false);
				}
			}
		},
		[
			conversationRef,
			isGeneratingResponse,
			setEditingMessage,
			setForceUpdate,
			getContext,
			plugin,
			runConversationTurn,
			handleTTS,
			lnModesRef,
			activeModeIdRef,
		]
	);

	const startEditingMessage = useCallback((messageIndex: number) => {
		// Check if index is valid and is a user message
		if (messageIndex < 0 || messageIndex >= conversationRef.current.length) {
			console.error(`Invalid message index for editing: ${messageIndex}`);
			return;
		}

		const targetMessage = conversationRef.current[messageIndex];
		if (targetMessage.role !== "user") {
			console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
			return;
		}

		// Extract text content and images from the message
		const contentBlocks = Array.isArray(targetMessage.content) ? targetMessage.content : [];
		
		const textContent = contentBlocks
			.filter(block => block.type === 'text')
			.map(block => (block as any).text || '')
			.join('\n');
		
		const imageBlocks = contentBlocks.filter(block => block.type === 'image');
		
		const images = imageBlocks.map(block => {
			const imageBlock = block as any;
			if (imageBlock.source && imageBlock.source.data) {
				return {
					id: Math.random().toString(36).substring(2, 11),
					name: `image.${imageBlock.source.media_type?.split('/')[1] || 'png'}`,
					src: `data:${imageBlock.source.media_type || 'image/png'};base64,${imageBlock.source.data}`
				};
			}
			return null;
		}).filter(Boolean);

		setEditingMessage({
			index: messageIndex,
			content: textContent,
			images: images
		});
	}, []);

	const cancelEditingMessage = useCallback(() => {
		setEditingMessage(null);
	}, []);

	const value: AIAgentContextType = {
		conversation: conversationRef.current,
		clearConversation,
		addUserMessage,
		editUserMessage,
		getContext,
		reset: clearConversation,
		isGeneratingResponse,
		editingMessage,
		startEditingMessage,
		cancelEditingMessage,
	};

	return (
		<AIAgentContext.Provider value={value}>
			{children}
		</AIAgentContext.Provider>
	);
};

export const useAIAgent = (): AIAgentContextType => {
	const context = useContext(AIAgentContext);
	if (context === undefined) {
		throw new Error("useAIAgent must be used within an AIAgentProvider");
	}
	return context;
};
