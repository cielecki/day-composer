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
} from '../types/chat-types';
import { LucideIcon } from "./LucideIcon";
import { LNModePill } from '../components/LNModePills';
import { TFile } from "obsidian";
import { Modal } from "obsidian";
import { t } from 'src/i18n';
import { UnifiedInputArea } from "./UnifiedInputArea";
import { SetupFlow } from "./setup/SetupFlow";
import { ConversationHistoryDropdown } from './ConversationHistoryDropdown';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageWithId } from '../store/chat-store';
import { useAutoscroll } from '../hooks/useAutoscroll';

// Add Zustand store imports
import {
	usePluginStore
} from "../store/plugin-store";

declare global {
	interface Window {
		app: import('obsidian').App;
	}
}

function openSimpleObsidianModal(app: import('obsidian').App, title: string, text: string) {
	class SimpleObsidianModal extends Modal {
		constructor(app: import('obsidian').App) {
			super(app);
		}
		onOpen() {
			const { contentEl } = this;
			contentEl.empty();
			
			// Create main container with flexbox layout
			const container = contentEl.createEl("div", { cls: "ln-simple-modal-container" });
			
			// Header section (always visible)
			const header = container.createEl("div", { cls: "ln-simple-modal-header" });
			header.createEl("h2", { text: title });
			
			// Content section (scrollable)
			const content = container.createEl("div", { cls: "ln-simple-modal-content" });
			const pre = content.createEl("pre", { cls: "ln-pre-code" });
			pre.innerText = text;
			
			// Footer section (always visible)
			const footer = container.createEl("div", { cls: "ln-simple-modal-footer" });
			const button = footer.createEl("button", { text: t('ui.modal.copyToClipboard'), cls: "mod-cta" });
			button.onclick = () => {
				navigator.clipboard.writeText(text);
				button.textContent = t('ui.modal.copied');
				setTimeout(() => (button.textContent = t('ui.modal.copyToClipboard')), 1200);
			};
		}
		onClose() {
			this.contentEl.empty();
		}
	}
	new SimpleObsidianModal(app).open();
}

export const LifeNavigatorApp: React.FC = () => {
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const modeIndicatorRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [conversationHistoryOpen, setConversationHistoryOpen] = useState(false);
	const conversationHistoryContainerRef = useRef<HTMLDivElement>(null);

	// Access specific state slices from the store with granular subscriptions
	// Use stable selectors to prevent infinite loops
	const rawConversation = usePluginStore(
		useCallback((state) => state.chats.current.storedConversation.messages, [])
	);
	const isGeneratingResponse = usePluginStore(state => state.chats.isGenerating);
	const editingMessage = usePluginStore(state => state.chats.editingMessage);
	const liveToolResults = usePluginStore(state => state.chats.liveToolResults);
	const availableModes = usePluginStore(state => state.modes.available);
	const activeModeId = usePluginStore(state => state.modes.activeId);
	const isModesLoading = usePluginStore(state => state.modes.isLoading);
	const isSpeaking = usePluginStore(state => state.audio.isSpeaking);
	const audioStop = usePluginStore(state => state.audioStop);
	const chatStop = usePluginStore(state => state.chatStop);

	// Create a stable reference to the conversation to prevent proxy issues
	// Only recreate when the conversation content actually changes
	const stableConversation = useMemo(() => {
		// Create a new array reference to avoid proxy issues
		return rawConversation ? [...rawConversation] : [];
	}, [rawConversation]);

	// Actions
	const clearChat = usePluginStore(state => state.clearChat);
	const setActiveModeWithPersistence = usePluginStore(state => state.setActiveModeWithPersistence);

	// Use actual store methods instead of placeholder functions
	const addUserMessage = usePluginStore(state => state.addUserMessage);
	const loadConversation = usePluginStore(state => state.loadConversation);
	const getCurrentConversationId = usePluginStore(state => state.getCurrentConversationId);
	const getSystemPrompt = usePluginStore(state => state.getSystemPrompt);

	// Get active mode
	const activeMode = availableModes[activeModeId];

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

	// Check if the active mode is actually available
	const isModeLoading = activeModeId && !availableModes[activeModeId];

	const toggleDropdown = useCallback(() => {
		setDropdownOpen(!dropdownOpen);
	}, [dropdownOpen]);

	// Handle clicks outside the dropdown to close it
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

	const handleConversationSelect = async (conversationId: string) => {
		try {
			if (isSpeaking || isGeneratingResponse) {
				audioStop();
			}
			chatStop();
			await loadConversation(conversationId);
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
								content={activeMode.ln_description}
							/>
						</div>

						{activeMode.ln_example_usages.length > 0 && (
							<div className="ln-mode-pills-container">
								{activeMode.ln_example_usages.map((usage, index) => (
									<LNModePill
										key={index}
										id={`${index}`}
										name={usage}
										onClick={() => {
											// If the mode has an auto-trigger message, send it
											if (usage) {
												console.debug(
													`Auto-triggering message for mode ${activeMode.ln_name}: "${usage}"`,
												);

																							// Wait a short moment before sending to ensure state updates have propagated
											setTimeout(() => {
												addUserMessage(usage);
											}, 100);
											}
										}}
									/>
								))}
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
					{/* Flex row for dropdown and menu button */}
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
									{activeMode.ln_icon && (
										<span className="ln-icon-center">
											<LucideIcon
												name={activeMode.ln_icon}
												size={18}
												color={
													activeMode.ln_icon_color ||
													"var(--text-normal)"
												}
											/>
										</span>
									)}
									<span className="ln-font-medium">
										{activeMode.ln_name}
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
									{!activeMode.ln_path.startsWith(':prebuilt:') && (
										<div
											className="ln-mode-action-item"
											onClick={() => {
												if (window.app && activeMode.ln_path) {
													const file = window.app.vault.getAbstractFileByPath(activeMode.ln_path);
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
									{/* <div
										className="ln-mode-action-item"
										onClick={() => {
											openSimpleObsidianModal(
												window.app,
												t('ui.modal.modeSettings').replace('{{modeName}}', activeMode.ln_name),
												JSON.stringify(activeMode, null, 2)
											);
											setDropdownOpen(false);
										}}
									>
										<LucideIcon name="settings" size={16} color="var(--text-normal)" /> 
										{t('ui.mode.viewSettings')}
									</div> */}
									<div
										className="ln-mode-action-item"
										onClick={async () => {
											const systemPrompt = await getSystemPrompt();
											openSimpleObsidianModal(
												window.app,
												t('ui.modal.systemPrompt').replace('{{modeName}}', activeMode.ln_name),
												systemPrompt || ""
											);
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
											className={`ln-mode-list-item ${mode.ln_path === activeMode?.ln_path ? 'active' : ''}`}
											onClick={async () => {
												await setActiveModeWithPersistence(mode.ln_path);
												setDropdownOpen(false);
											}}
										>
											{mode.ln_icon && (
												<span className="ln-icon-center">
													<LucideIcon
														name={mode.ln_icon}
														size={16}
														color={mode.ln_icon_color || "var(--text-normal)"}
													/>
												</span>
											)}
											<span className="ln-text-sm ln-whitespace-nowrap ln-text-ellipsis">
												{mode.ln_name}
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
							await usePluginStore.getState().saveImmediatelyIfNeeded(false);
							clearChat();
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
								currentConversationId={getCurrentConversationId()}
							/>
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
					/>
				))}

				{isGeneratingResponse && <ThinkingMessage status="thinking" />}
			</div>

			{activeMode && <div className="controls-container">
				<div className="button-container">
					<UnifiedInputArea
						editingMessage={editingMessage}
					/>
				</div>
			</div> }
		</div>
	);
};
