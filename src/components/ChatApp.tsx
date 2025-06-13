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
import { TFile, Modal, Notice } from "obsidian";
import { t } from 'src/i18n';
import { UnifiedInputArea } from "./UnifiedInputArea";
import { SetupFlow } from "./setup/SetupFlow";
import { ConversationHistoryDropdown } from './ConversationHistoryDropdown';
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

// Add Zustand store imports
import {
	usePluginStore
} from "../store/plugin-store";

interface ChatAppProps {
	chatId: string;
}

export const ChatApp: React.FC<ChatAppProps> = ({ chatId }) => {
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const modeIndicatorRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [conversationHistoryOpen, setConversationHistoryOpen] = useState(false);
	const conversationHistoryContainerRef = useRef<HTMLDivElement>(null);

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
	
	// Derive values from store state (no additional hooks)
	const chatActiveModeId = chatState?.activeModeId || DEFAULT_MODE_ID;
	const rawConversation = chatState?.chat.storedConversation.messages || [];
	const isGeneratingResponse = chatState?.isGenerating || false;
	const editingMessage = chatState?.editingMessage || null;
	const liveToolResults = chatState?.liveToolResults || new Map();
	const currentConversationMeta = chatState?.chat.meta || null;

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

	const toggleDropdown = useCallback(() => {
		setDropdownOpen(!dropdownOpen);
	}, [dropdownOpen]);

	// Handle clicks outside dropdowns and menus to close them
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				modeIndicatorRef.current &&
				!modeIndicatorRef.current.contains(event.target as Node)
			) {
				setDropdownOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	// Add useEffect for click-away for the 3-dot menu
	useEffect(() => {
		if (!menuOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(event.target as Node) &&
				menuButtonRef.current &&
				!menuButtonRef.current.contains(event.target as Node)
			) {
				setMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [menuOpen]);

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

	// Handle mode switching for this specific chat
	const handleModeSwitch = useCallback(async (modeId: string) => {
		// Only update this chat's mode - don't affect global mode or other chats
		setActiveModeForChat(chatId, modeId);
	}, [setActiveModeForChat, chatId]);

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
				<div
					className="chat-bar-title ln-relative ln-overflow-visible"
				>
					{/* Flex row for dropdown and new chat button */}
					<div className="ln-flex ln-items-center ln-gap-1">
						<div
							className={`ln-mode-indicator ${dropdownOpen ? 'open' : ''}`}
							onClick={toggleDropdown}
							ref={modeIndicatorRef}
						>
							{isModeLoading ? (
								// Loading state - show generic loading with appropriate icon
								<>
									<span className="ln-icon-center">
										<LucideIcon
											name={isModesLoading ? "loader-2" : "clock"}
											size={18}
											color="var(--text-muted)"
											className={isModesLoading ? "animate-spin" : ""}
										/>
									</span>
									<span className="ln-font-medium ln-text-muted">
										{t('ui.mode.loading')}
									</span>
								</>
							) : activeMode ? (
								// Normal state - show loaded mode
								<>
									{activeMode.icon && (
										<span className="ln-icon-center">
											<LucideIcon
												name={activeMode.icon}
												size={18}
												color={
													activeMode.icon_color ||
													"var(--text-normal)"
												}
											/>
										</span>
									)}
									<span className="ln-font-medium">
										{activeMode.name}
									</span>
								</>
							) : (
								// No mode selected state
								<>
									<span className="ln-icon-center">
										<LucideIcon
											name="help-circle"
											size={18}
											color="var(--text-muted)"
										/>
									</span>
									<span className="ln-font-medium ln-text-muted">
										Select a mode
									</span>
								</>
							)}
							<span className={`ln-chevron ln-ml-1 ${dropdownOpen ? 'open' : ''}`}>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<polyline points="6 9 12 15 18 9"></polyline>
								</svg>
							</span>
						</div>
					</div>

					{/* Mode selection dropdown */}
					{dropdownOpen && (
						<div
							ref={dropdownRef}
							className="ln-mode-dropdown"
						>
							{/* Actions - only show when activeMode is loaded */}
							{activeMode && (
								<>
									{!activeMode.path.startsWith(':prebuilt:') && (
										<div
											className="ln-mode-action-item"
											onClick={() => {
												if (window.app && activeMode.path) {
													const file = window.app.vault.getAbstractFileByPath(activeMode.path);
													if (file instanceof TFile) {
														window.app.workspace.getLeaf().openFile(file);
													}
												}
												setDropdownOpen(false);
											}}
										>
											<LucideIcon name="external-link" size={16} color="var(--text-normal)" />
											{t('ui.mode.openInEditor')}
										</div>
									)}
									<div
										className="ln-mode-action-item"
										onClick={async () => {
											const plugin = LifeNavigatorPlugin.getInstance();
											if (plugin && chatActiveModeId) {
												await plugin.openSystemPrompt(chatActiveModeId);
											}
											setDropdownOpen(false);
										}}
									>
										<LucideIcon name="terminal" size={16} color="var(--text-normal)" />
										{t('ui.mode.viewSystemPrompt')}
									</div>

									{/* Separator */}
									<div className="ln-separator" />
								</>
							)}

							{/* "switch to" label */}
							<div className="ln-section-label">
								{t('ui.mode.switchTo')}
							</div>

							{/* Mode list */}
							{Object.keys(availableModes).length > 0 && (
								<>
									{Object.values(availableModes).map((mode, index) => (
										<div
											key={index}
											className={`ln-mode-list-item ${mode.path === activeMode?.path ? 'active' : ''}`}
											onClick={async () => {
												await handleModeSwitch(mode.path);
												setDropdownOpen(false);
											}}
										>
											{mode.icon && (
												<span className="ln-icon-center">
													<LucideIcon
														name={mode.icon}
														size={16}
														color={mode.icon_color || "var(--text-normal)"}
													/>
												</span>
											)}
											<span className="ln-text-sm ln-whitespace-nowrap ln-text-ellipsis">
												{mode.name}
											</span>
										</div>
									))}

								</>
							)}
						</div>
					)}
				</div>
				<div className="chat-bar-actions">
					<button
						className="clickable-icon"
						aria-label={t('ui.chat.new')}
						onClick={async () => {
							// Save current conversation immediately before starting new chat
							await usePluginStore.getState().saveImmediatelyIfNeeded(chatId, false);
							handleClearChat();
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

					<div className="ln-relative" ref={menuRef}>
						<button
							ref={menuButtonRef}
							className="clickable-icon"
							aria-label="More options"
							onClick={() => setMenuOpen(!menuOpen)}
						>
							<LucideIcon name="more-horizontal" size={18} />
						</button>

						{menuOpen && (
							<div className="ln-chat-menu-dropdown">
								<div className="ln-chat-menu-item" onClick={async () => {
									try {
										const plugin = LifeNavigatorPlugin.getInstance();
										await plugin.openViewWithStandardBehavior(
											LIFE_NAVIGATOR_VIEW_TYPE,
											{ chatId: chatId },
											undefined,
											'tab'
										);
									} catch (error) {
										console.error('Failed to open chat in new tab:', error);
									}
									setMenuOpen(false);
								}}>
									<LucideIcon name="external-link" size={16} />
									<span>{t('ui.chat.openInNewTab')}</span>
								</div>
								<div className="ln-separator" />
								<div className="ln-chat-menu-item" onClick={async () => {
									try {
										const plugin = LifeNavigatorPlugin.getInstance();
										await plugin.openCostAnalysis(currentConversationMeta?.id || undefined);
									} catch (error) {
										console.error('Failed to open cost analysis:', error);
									}
									setMenuOpen(false);
								}}>
									<LucideIcon name="dollar-sign" size={16} />
									<span>{t('costAnalysis.menu.viewCosts')}</span>
								</div>
								{currentConversationMeta && currentConversationMeta.filePath && (
									<>
										<div className="ln-chat-menu-item" onClick={async () => {
											if (currentConversationMeta?.id) {
												try {
													if (currentConversationMeta && currentConversationMeta.filePath) {
														await revealFileInSystem(currentConversationMeta.filePath);
													}
												} catch (error) {
													console.error('Failed to reveal conversation file:', error);
												}
											}
											setMenuOpen(false);
										}}>
											<LucideIcon name="folder-open" size={16} />
											<span>{PlatformUtils.getRevealLabel()}</span>
										</div>
										<div className="ln-chat-menu-item" onClick={async () => {
											if (currentConversationMeta?.id) {
												await handleDeleteConversation(currentConversationMeta.id, deleteConversation);
											}
											setMenuOpen(false);
										}}>
											<LucideIcon name="trash-2" size={16} />
											<span>{t('ui.chat.delete')}</span>
										</div>
									</>
								)}
								<div className="ln-separator" />
								<div className="ln-chat-menu-item" onClick={() => {
									window.open('https://github.com/cielecki/life-navigator', '_blank');
									setMenuOpen(false);
								}}>
									<LucideIcon name="github" size={16} />
									<span>{t('costAnalysis.menu.githubRepo')}</span>
								</div>
								<div className="ln-chat-menu-item" onClick={() => {
									window.open('https://discord.com/invite/VrxZdr3JWH', '_blank');
									setMenuOpen(false);
								}}>
									<LucideIcon name="message-circle" size={16} />
									<span>{t('costAnalysis.menu.discordCommunity')}</span>
								</div>
								<div className="ln-chat-menu-item" onClick={() => {
									window.open('https://x.com/mcielecki', '_blank');
									setMenuOpen(false);
								}}>
									<LucideIcon name="user" size={16} />
									<span>{t('costAnalysis.menu.authorTwitter')}</span>
								</div>
							</div>
						)}
					</div>
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

			{activeMode && <div className="controls-container">
				<div className="button-container">
					<UnifiedInputArea
						editingMessage={editingMessage}
						chatId={chatId}
					/>
				</div>
			</div>}
		</div>
	);
};
