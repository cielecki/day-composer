import React, {
	useRef,
	useEffect,
	useCallback,
	useMemo,
	useState,
} from "react";
import { MessageDisplay } from "./MessageDisplay";
import { ThinkingMessage } from "./ThinkingMessage";
import {
	ToolResultBlock,
	ContentBlock,
} from '../types/message';
import { LucideIcon } from "./LucideIcon";
import { LNModePill } from '../components/LNModePills';
import { TFile } from "obsidian";
import { t } from 'src/i18n';
import { UnifiedInputArea } from "./UnifiedInputArea";
import { SetupFlow } from "./setup/SetupFlow";
import { ConversationHistoryDropdown } from './ConversationHistoryDropdown';
import { ChatMenuDropdown } from './ChatMenuDropdown';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageWithId } from '../store/chat-store';
import { useAutoscroll } from '../hooks/useAutoscroll';
import { ValidationFixButton } from './ValidationFixButton';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { LIFE_NAVIGATOR_VIEW_TYPE, ChatView } from '../views/chat-view';
import { handleDeleteConversation } from 'src/utils/chat/delete-conversation-handler';
import { revealFileInSystem } from 'src/utils/chat/reveal-file-handler';
import { PlatformUtils } from 'src/utils/platform';
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';
import { ChatTitleEditor } from './ChatTitleEditor';

// Add Zustand store imports
import {
	usePluginStore
} from "../store/plugin-store";

interface ChatAppProps {
	chatId: string;
}

export const ChatApp: React.FC<ChatAppProps> = ({ chatId }) => {
	const [conversationHistoryOpen, setConversationHistoryOpen] = useState(false);
	const conversationHistoryContainerRef = useRef<HTMLDivElement>(null);
	const [isTitleEditing, setIsTitleEditing] = useState(false);

	// Access all store state in a consistent order
	const chatState = usePluginStore(
		useCallback((state) => state.getChatState(chatId), [chatId])
	);
	const availableModes = usePluginStore(state => state.modes.available);
	const isModesLoading = usePluginStore(state => state.modes.isLoading);
	const isSpeaking = usePluginStore(state => state.audio.isSpeaking);
	const isGeneratingSpeech = usePluginStore(state => state.audio.isGeneratingSpeech);
	const audioStop = usePluginStore(state => state.audioStop);
	const chatStop = usePluginStore(state => state.chatStop);

	const markChatAsRead = usePluginStore(state => state.markChatAsRead);

	// Derive values from store state (no additional hooks)
	const chatActiveModeId = chatState?.chat.storedConversation.modeId || DEFAULT_MODE_ID;
	const rawConversation = chatState?.chat.storedConversation.messages || [];
	const isGeneratingResponse = chatState?.isGenerating || false;
	const editingMessage = chatState?.editingMessage || null;
	const liveToolResults = chatState?.liveToolResults || new Map();
	const currentConversationMeta = chatState?.chat.meta || null;
	
	// Chat title and unread status
	const chatTitle = chatState?.chat.storedConversation.title || '';
	const isUnread = chatState?.chat.storedConversation.isUnread || false;

	// Store methods that now require chatId
	const loadConversation = usePluginStore(state => state.loadConversation);
	const deleteConversation = usePluginStore(state => state.deleteConversation);
	const loadChat = usePluginStore(state => state.loadChat);
	const createNewChat = usePluginStore(state => state.createNewChat);

	// Create a stable reference to the conversation to prevent proxy issues
	const stableConversation = useMemo(() => {
		return rawConversation ? [...rawConversation] : [];
	}, [rawConversation]);

	// Actions that now require chatId
	const clearChat = usePluginStore(state => state.clearChat);
	const setActiveModeForChat = usePluginStore(state => state.setActiveModeForChat);
	const addUserMessage = usePluginStore(state => state.addUserMessage);

	// Get active mode (chat-specific or global fallback)
	const activeMode = availableModes[chatActiveModeId];

	const conversationContainerRef = useRef<HTMLDivElement>(null);

	// Build a map of tool results (tool_use_id -> ToolResultBlock)
	// Merge stored results with live results for real-time updates
	const toolResultsMap = useMemo(() => {
		const resultsMap = new Map<string, ToolResultBlock>();

		// First, add all stored tool results from the conversation
		stableConversation.forEach((message) => {
			if (Array.isArray(message.content)) {
				message.content.forEach((item: ContentBlock) => {
					if (
						typeof item === "object" &&
						item !== null &&
						"type" in item &&
						item.type === "tool_result"
					) {
						const toolResult = item as ToolResultBlock;
						resultsMap.set(toolResult.tool_use_id, toolResult);
					}
				});
			}
		});

		// Then, overlay live tool results (these will take precedence for ongoing executions)
		for (const [toolId, liveResult] of liveToolResults) {
			resultsMap.set(toolId, liveResult);
		}

		return resultsMap;
	}, [stableConversation, liveToolResults]);

	// Filter out user messages that contain only tool results
	const filteredConversation = useMemo(() => {
		let conversationToFilter = stableConversation;

		// If editing, only show messages up to (but NOT including) the one being edited
		if (editingMessage) {
			conversationToFilter = stableConversation.slice(0, editingMessage.index);
		}

		const filtered = conversationToFilter.filter((message) => {
			if (message.role === "assistant") {
				return true;
			}

			if (message.role === "user" && Array.isArray(message.content)) {
				// Cast message.content to ContentBlock[] first
				const contentBlocks = message.content as ContentBlock[];
				const isOnlyToolResults =
					contentBlocks.length > 0 &&
					contentBlocks.every(
						(item) =>
							typeof item === "object" &&
							item !== null &&
							"type" in item &&
							item.type === "tool_result",
					);

				return !isOnlyToolResults;
			}

			return true;
		});

		return filtered;
	}, [stableConversation, editingMessage]);

	// Create a mapping from filtered conversation indices to original conversation indices
	const messageIndexMap = useMemo(() => {
		const indexMap: Array<{ filteredIndex: number; originalIndex: number; messageId: string }> = [];
		let filteredIndex = 0;

		stableConversation.forEach((message, originalIndex) => {
			// Skip messages during editing
			if (editingMessage && originalIndex >= editingMessage.index) {
				return;
			}

			let shouldInclude = true;

			if (message.role === "user" && Array.isArray(message.content)) {
				const contentBlocks = message.content as ContentBlock[];
				const isOnlyToolResults =
					contentBlocks.length > 0 &&
					contentBlocks.every(
						(item) =>
							typeof item === "object" &&
							item !== null &&
							"type" in item &&
							item.type === "tool_result",
					);

				shouldInclude = !isOnlyToolResults;
			}

			if (shouldInclude) {
				const messageWithId = message as MessageWithId;
				const messageId = messageWithId.messageId || `fallback-${originalIndex}`;

				indexMap.push({
					filteredIndex,
					originalIndex,
					messageId
				});
				filteredIndex++;
			}
		});

		return indexMap;
	}, [stableConversation, editingMessage]);

	// Unified autoscroll hook - handles both static and streaming updates
	const { scrollRef: autoscrollRef, scrollToBottom } = useAutoscroll(
		filteredConversation, // Dependency - scroll when conversation changes
		{
			threshold: 100,        // Consider "at bottom" when within 100px
			smooth: true,          // Use smooth scrolling
			enabled: true,         // Always enabled
			isStreaming: isGeneratingResponse // Switch between modes
		}
	);

	// Keep both refs in sync
	useEffect(() => {
		if (autoscrollRef.current) {
			conversationContainerRef.current = autoscrollRef.current;
		}
	}, [autoscrollRef]);


	// Mark chat as read when this component gains focus

	// Handle workspace active leaf changes to detect when this chat gains focus
	useEffect(() => {
		const plugin = LifeNavigatorPlugin.getInstance();
		if (!plugin) return;

		const handleActiveLeafChange = () => {
			const activeLeaf = plugin.app.workspace.activeLeaf;

			console.debug(`[CHAT-APP] Active leaf changed. Current chatId: ${chatId}`);

			if (activeLeaf && activeLeaf.view.getViewType() === LIFE_NAVIGATOR_VIEW_TYPE) {
				const chatView = activeLeaf.view as ChatView;
				const activeChatId = chatView.getChatId();

				console.debug(`[CHAT-APP] Active leaf is chat view. Active chatId: ${activeChatId}, Current chatId: ${chatId}`);

				// Only mark as read if this is the active chat
				if (activeChatId === chatId) {
					console.debug(`[CHAT-APP] Marking chat ${chatId} as read due to tab focus`);
					markChatAsRead(chatId);
				}
			} else {
				console.debug(`[CHAT-APP] Active leaf is not a chat view or is null`);
			}
		};

		// Register the event listener
		plugin.app.workspace.on('active-leaf-change', handleActiveLeafChange);

		// Check initial state
		console.debug(`[CHAT-APP] Checking initial active leaf state for chat ${chatId}`);
		handleActiveLeafChange();

		// Cleanup
		return () => {
			plugin.app.workspace.off('active-leaf-change', handleActiveLeafChange);
		};
	}, [chatId, markChatAsRead]);

	// Additional fallback: mark as read when component becomes visible/focused
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				// Document became visible, check if this chat is active
				const plugin = LifeNavigatorPlugin.getInstance();
				const activeLeaf = plugin?.app.workspace.activeLeaf;

				if (activeLeaf && activeLeaf.view.getViewType() === LIFE_NAVIGATOR_VIEW_TYPE) {
					const chatView = activeLeaf.view as ChatView;
					const activeChatId = chatView.getChatId();

					if (activeChatId === chatId) {
						console.debug(`[CHAT-APP] Marking chat ${chatId} as read due to visibility change`);
						markChatAsRead(chatId);
					}
				}
			}
		};

		const handleWindowFocus = () => {
			// Window gained focus, check if this chat is active
			const plugin = LifeNavigatorPlugin.getInstance();
			const activeLeaf = plugin?.app.workspace.activeLeaf;

			if (activeLeaf && activeLeaf.view.getViewType() === LIFE_NAVIGATOR_VIEW_TYPE) {
				const chatView = activeLeaf.view as ChatView;
				const activeChatId = chatView.getChatId();

				if (activeChatId === chatId) {
					console.debug(`[CHAT-APP] Marking chat ${chatId} as read due to window focus`);
					markChatAsRead(chatId);
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleWindowFocus);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleWindowFocus);
		};
	}, [chatId, markChatAsRead]);

	// Handle chat switching
	const prevChatIdRef = useRef<string | null>(null);
	useEffect(() => {
		prevChatIdRef.current = chatId;
	}, [chatId]);

	// CRITICAL: Ensure chat is loaded when component mounts
	useEffect(() => {
		const ensureChatLoaded = async () => {
			// If chat state doesn't exist, try to load it
			if (!chatState) {
				console.debug(`Chat ${chatId} not found, attempting to load or create...`);

				// Try to load from database first
				const loaded = await loadChat(chatId);

				if (!loaded) {
					// If loading failed, this might be a new chat ID that needs to be created
					console.debug(`Failed to load chat ${chatId}, this might be a new chat`);
					// Note: We don't create here as it could cause ID conflicts
					// The ChatView should handle creating new chats
				}
			}
		};

		ensureChatLoaded();
	}, [chatId, chatState, loadChat]);

	// Check if the active mode is actually available
	const isModeLoading = chatActiveModeId && !availableModes[chatActiveModeId];



	// Add useEffect for conversation history dropdown click-away
	useEffect(() => {
		if (!conversationHistoryOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			if (
				conversationHistoryContainerRef.current &&
				!conversationHistoryContainerRef.current.contains(event.target as Node)
			) {
				setConversationHistoryOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [conversationHistoryOpen]);



	// Handle user message with chat ID
	const handleAddUserMessage = useCallback(async (message: string, images?: any[]) => {
		await addUserMessage(chatId, message, images);
	}, [addUserMessage, chatId]);

	// Handle clear chat for this specific chat
	const handleClearChat = useCallback(() => {
		clearChat(chatId);
	}, [clearChat, chatId]);

	// Handle chat stop for this specific chat
	const handleChatStop = useCallback(() => {
		chatStop(chatId);
	}, [chatStop, chatId]);

	// Handle conversation selection (for history dropdown)
	const handleConversationSelect = async (conversationId: string) => {
		try {
			// Only stop audio, don't stop the chat generation
			if (isSpeaking || isGeneratingSpeech) {
				audioStop();
			}

			// Load the conversation and update the current view's state
			const success = await loadConversation(conversationId);

			if (success) {
				// Find the current ChatView and update its chatId
				const plugin = LifeNavigatorPlugin.getInstance();
				const activeLeaf = plugin.app.workspace.activeLeaf;

				if (activeLeaf && activeLeaf.view.getViewType() === LIFE_NAVIGATOR_VIEW_TYPE) {
					const chatView = activeLeaf.view as ChatView;
					chatView.updateChatId(conversationId);
				}
			}
		} catch (error) {
			console.error('Failed to load conversation:', error);
		}
	};

	// Handler for the "Edit Title" menu option
	const handleEditTitleFromMenu = useCallback(() => {
		setIsTitleEditing(true);
	}, []);

	// Render empty conversation content
	const renderEmptyConversation = () => {
		if (
			filteredConversation.length === 0 &&
			!isSpeaking &&
			!isGeneratingResponse &&
			!editingMessage
		) {
			// Show normal mode content when loaded
			if (activeMode) {
				return (
					<div className="empty-conversation">
						<div className="markdown-content">
							<MarkdownRenderer
								content={activeMode.description}
							/>
						</div>

						{activeMode.example_usages.length > 0 && (
							<div className="ln-mode-pills-container">
								{activeMode.example_usages.map((usage, index) => (
									<LNModePill
										key={index}
										id={`${index}`}
										name={usage}
										onClick={() => {
											// If the mode has an auto-trigger message, send it
											if (usage) {
												console.debug(
													`Auto-triggering message for mode ${activeMode.name}: "${usage}"`,
												);

												// Wait a short moment before sending to ensure state updates have propagated
												setTimeout(() => {
													handleAddUserMessage(usage);
												}, 100);
											}
										}}
									/>
								))}
							</div>
						)}

						{/* Show validation fix buttons if we're in Guide mode and there are issues */}
						{activeMode.path === ':prebuilt:guide' && (
							<div className="validation-issues-container">
								<ValidationFixButton type="modes" />
								<ValidationFixButton type="tools" />
							</div>
						)}
					</div>
				);
			}

			return (
				<div className="empty-conversation">

				</div>
			);
		}
		return null;
	};

	// Check if setup is complete
	const isSetupCompleted = usePluginStore(state => state.isSetupComplete());

	// If setup is not complete, show setup flow
	if (!isSetupCompleted) {
		return (
			<SetupFlow
				lnModes={availableModes}
			/>
		);
	}

	return (
		<div className="life-navigator-view-content">
			<div className="chat-bar">
				<div className="chat-bar-title">
					<ChatTitleEditor
						chatId={chatId}
						title={chatTitle}
						isUnread={isUnread}
						forceEdit={isTitleEditing}
						onStartEdit={() => setIsTitleEditing(true)}
						onFinishEdit={() => setIsTitleEditing(false)}
					/>
				</div>
				<div className="chat-bar-actions">
					<button
						className="clickable-icon"
						aria-label={t('ui.chat.new')}
						onClick={async () => {

							// Save current conversation immediately before creating new chat
							await usePluginStore.getState().saveImmediatelyIfNeeded(chatId, false);

							// Create a new chat with the current mode
							const store = usePluginStore.getState();
							const newChatId = store.createNewChat(chatActiveModeId);

							// Update the current ChatView to use the new chat ID
							const plugin = LifeNavigatorPlugin.getInstance();
							const activeLeaf = plugin.app.workspace.activeLeaf;

							if (activeLeaf && activeLeaf.view.getViewType() === LIFE_NAVIGATOR_VIEW_TYPE) {
								const chatView = activeLeaf.view as ChatView;
								chatView.updateChatId(newChatId);
							}
						}}
					>
						<LucideIcon name="square-pen" size={18} />
					</button>

					<div
						className="ln-relative"
						ref={conversationHistoryContainerRef}
					>
						<button
							className="clickable-icon"
							aria-label={t('ui.chat.history')}
							onClick={() => setConversationHistoryOpen(!conversationHistoryOpen)}
						>
							<LucideIcon name="history" size={18} />
						</button>

						{conversationHistoryOpen && (
							<ConversationHistoryDropdown
								onConversationSelect={handleConversationSelect}
								isOpen={conversationHistoryOpen}
								onToggle={() => setConversationHistoryOpen(false)}
								currentConversationId={currentConversationMeta?.id || null}
							/>
						)}
					</div>

					<ChatMenuDropdown
						chatId={chatId}
						conversationMetaId={currentConversationMeta?.id}
						conversationFilePath={currentConversationMeta?.filePath}
						onDelete={async () => {
							if (currentConversationMeta?.id) {
								await handleDeleteConversation(currentConversationMeta.id, deleteConversation);
							}
						}}
						onEditTitle={handleEditTitleFromMenu}
					/>
				</div>
			</div>

			<div
				className="conversation-container"
				ref={autoscrollRef}
			>
				{renderEmptyConversation()}

				{filteredConversation.map((message, index) => (
					<MessageDisplay
						key={messageIndexMap[index].messageId}
						role={message.role}
						content={message.content}
						toolResults={toolResultsMap}
						messageIndex={messageIndexMap[index].originalIndex}
						isLastMessage={index === filteredConversation.length - 1}
						isGeneratingResponse={isGeneratingResponse}
						chatId={chatId}
						modeId={message.modeId}
					/>
				))}

				{/* Show validation fix button for current mode if it has issues */}
				{!isGeneratingResponse && activeMode && <ValidationFixButton
					type="specific-mode"
					modeId={activeMode.path}
					displayMode="text-and-button"
				/>}

				{isGeneratingResponse && <ThinkingMessage status="thinking" />}
			</div>

			<div className="controls-container">
				<div className="button-container">
					<UnifiedInputArea
						editingMessage={editingMessage}
						chatId={chatId}
					/>
				</div>
			</div>
		</div>
	);
};
