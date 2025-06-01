import React, {
	useRef,
	useEffect,
	useCallback,
	useMemo,
	useState,
} from "react";
import { MessageDisplay } from "./MessageDisplay";
import { useTextToSpeech } from "../context/TextToSpeechContext";
import { ThinkingMessage } from "./ThinkingMessage";
import { useLNMode } from "../context/LNModeContext";
import {
	ToolResultBlock,
	ContentBlock,
} from "src/types/types";
import { NavigationTarget } from "src/obsidian-tools";
import { useAIAgent } from "src/context/AIAgentContext";
import { LucideIcon } from "./LucideIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LNModePill } from "./LNModePills";
import { TFile } from "obsidian";
import { Modal } from "obsidian";
import { t } from '../i18n';
import { UnifiedInputArea } from "./UnifiedInputArea";
import { isSetupComplete } from "../utils/setup-state";
import { SetupFlow } from "./setup/SetupFlow";
import { ConversationHistoryDropdown } from './ConversationHistoryDropdown';

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
			contentEl.createEl("h2", { text: title });
			const pre = contentEl.createEl("pre");
			pre.style.background = "var(--background-secondary)";
			pre.style.borderRadius = "4px";
			pre.style.padding = "12px";
			pre.style.fontFamily = "var(--font-monospace)";
			pre.style.fontSize = "14px";
			pre.style.maxHeight = "600px";
			pre.style.overflow = "auto";
			pre.style.whiteSpace = "pre-wrap";
			pre.innerText = text;
			const button = contentEl.createEl("button", { text: t('ui.modal.copyToClipboard'), cls: "mod-cta", attr: { style: "margin-top: 20px;" } });
			button.style.marginTop = "16px";
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
	const [abortController, setAbortController] =
		useState<AbortController | null>(null);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const modeIndicatorRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [, setForceUpdate] = useState(0);
	const [conversationHistoryOpen, setConversationHistoryOpen] = useState(false);
	const conversationHistoryButtonRef = useRef<HTMLButtonElement>(null);

	const {
		conversation,
		clearConversation,
		addUserMessage,
		getContext,
		editingMessage,
		editUserMessage,
		isGeneratingResponse,
		loadConversation,
		getCurrentConversationId,
		getConversationDatabase,
	} = useAIAgent();

	// Use LNModes context
	const { lnModesRef, activeModeIdRef, setActiveModeId } = useLNMode();
	const activeMode = lnModesRef.current[activeModeIdRef.current];

	const conversationContainerRef = useRef<HTMLDivElement>(null);

	const { isPlayingAudio, stopAudio } = useTextToSpeech();

	// Build a map of tool results (tool_use_id -> result content and navigation targets)
	const toolResultsMap = useMemo(() => {
		const resultsMap = new Map<string, { content: string; navigationTargets?: NavigationTarget[] }>();

		conversation.forEach((message) => {
			if (message.role === "user" && Array.isArray(message.content)) {
				message.content.forEach((item) => {
					if (
						typeof item === "object" &&
						item !== null &&
						"type" in item &&
						item.type === "tool_result"
					) {
						const toolResult = item as ToolResultBlock;
						resultsMap.set(
							toolResult.tool_use_id,
							{
								content: toolResult.content,
								navigationTargets: toolResult.navigationTargets
							}
						);
					}
				});
			}
		});

		return resultsMap;
	}, [conversation]);

	// Filter out user messages that contain only tool results
	const filteredConversation = useMemo(() => {
		let conversationToFilter = conversation;
		
		// If editing, only show messages up to (but NOT including) the one being edited
		if (editingMessage) {
			conversationToFilter = conversation.slice(0, editingMessage.index);
		}

		return conversationToFilter.filter((message) => {
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
	}, [conversation, editingMessage]);

	// Create a mapping from filtered conversation indices to original conversation indices
	const filteredToOriginalIndexMap = useMemo(() => {
		const indexMap: number[] = [];
		let originalIndex = 0;
		
		for (const message of conversation) {
			if (message.role === "assistant") {
				indexMap.push(originalIndex);
				originalIndex++;
				continue;
			}

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

				if (!isOnlyToolResults) {
					indexMap.push(originalIndex);
				}
			} else {
				indexMap.push(originalIndex);
			}
			
			originalIndex++;
		}
		
		return indexMap;
	}, [conversation]);

	// Helper function to scroll to bottom
	const scrollToBottom = useCallback(() => {
		if (conversationContainerRef.current) {
			const container = conversationContainerRef.current;
			requestAnimationFrame(() => {
				container.scrollTop = container.scrollHeight;
			});
		}
	}, []);

	// Effect to scroll to bottom when conversation history updates (but not during streaming)
	useEffect(() => {
		// Only scroll on conversation changes when not generating to avoid double-scrolling
		if (!isGeneratingResponse) {
			scrollToBottom();
		}
	}, [filteredConversation, scrollToBottom, isGeneratingResponse]);

	// Effect to handle autoscroll during streaming
	useEffect(() => {
		if (isGeneratingResponse && conversationContainerRef.current) {
			const container = conversationContainerRef.current;
			
			// Create a MutationObserver to watch for content changes during streaming
			const observer = new MutationObserver(() => {
				// Debounce the scroll to avoid excessive scrolling
				requestAnimationFrame(() => {
					container.scrollTop = container.scrollHeight;
				});
			});

			// Observe changes to the conversation container and its children
			observer.observe(container, {
				childList: true,
				subtree: true,
				characterData: true,
			});

			// Scroll immediately when generation starts
			scrollToBottom();

			// Cleanup observer when generation stops or component unmounts
			return () => {
				observer.disconnect();
			};
		}
	}, [isGeneratingResponse, scrollToBottom]);

	const newAbortController = useCallback(() => {
		const abortController = new AbortController();
		setAbortController(abortController);
		return abortController;
	}, [setAbortController]);

	const abort = useCallback(() => {
		if (abortController) {
			console.log("Aborting in-progress operations while preserving conversation history");
			// Abort the controller but do NOT clear the conversation
			abortController.abort();
			setAbortController(null);
			
			// After a short delay, clean up any incomplete tool calls that may have been left
			// We delay this to allow the abort to propagate through the async operations
			setTimeout(() => {
				const currentConversation = conversation;
				if (currentConversation.length > 0) {
					const lastMessage = currentConversation[currentConversation.length - 1];
					
					if (lastMessage.role === "assistant") {
						const contentBlocks = Array.isArray(lastMessage.content) 
							? lastMessage.content 
							: typeof lastMessage.content === "string" 
								? [{ type: "text", text: lastMessage.content }] 
								: [];
								
						const toolUseBlocks = contentBlocks.filter(block => 
							typeof block === "object" && block !== null && "type" in block && block.type === "tool_use"
						);
						
						if (toolUseBlocks.length > 0) {
							console.log("Detected incomplete tool calls after abort, these will be cleaned up on next API call");
						}
					}
				}
			}, 500);
		}
		// Also stop any playing audio
		stopAudio();
	}, [abortController, setAbortController, stopAudio, conversation]);


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

	const handleConversationSelect = async (conversationId: string) => {
		try {
			const success = await loadConversation(conversationId);
			if (success) {
				// Clear any current abort controller
				if (abortController) {
					abortController.abort();
					setAbortController(null);
				}
				setForceUpdate((prev) => prev + 1);
			}
		} catch (error) {
			console.error('Failed to load conversation:', error);
		}
	};


	// Render empty conversation content
	const renderEmptyConversation = () => {
		if (
			filteredConversation.length === 0 &&
			!isPlayingAudio &&
			!isGeneratingResponse
		) {
			return (
				<div className="empty-conversation">
					<div className="markdown-content">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							components={{
								code: ({
									node,
									inline,
									className,
									children,
									...props
								}: any) => {
									return !inline ? (
										<pre className="code-block">
											<code
												className={className}
												{...props}
											>
												{children}
											</code>
										</pre>
									) : (
										<code
											className={className}
											{...props}
										>
											{children}
										</code>
									);
								},
							}}
						>
							{activeMode ? activeMode.ln_description : t('ui.starterKit.noModes')}
						</ReactMarkdown>
					</div>

						{Object.keys(lnModesRef.current).length === 0 && (
							<button
								className="mod-cta"
								onClick={() => {
									if (window.app) {
										// @ts-ignore - Using the Obsidian command API
										window.app.commands.executeCommandById(
											"life-navigator:create-starter-kit",
										);
									}
								}}
							>
								{t('ui.mode.createStarterKit')}
							</button>
						)}

					{activeMode && activeMode.ln_example_usages.length > 0 && (
						<div className="ln-mode-pills-container">
							{activeMode.ln_example_usages.map((usage, index) => (
								<LNModePill
									key={index}
									id={`${index}`}
									name={usage}
									onClick={() => {
										// If the mode has an auto-trigger message, send it
										if (usage) {
											console.log(
												`Auto-triggering message for mode ${activeMode.ln_name}: "${usage}"`,
											);

											// Need to create a new abort controller here
											const abortController = newAbortController();

											// Wait a short moment before sending to ensure state updates have propagated
											setTimeout(() => {
												addUserMessage(
													usage,
													abortController.signal,
												);
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
		return null;
	};

	// Check if setup is complete
	const isSetupCompleted = isSetupComplete(lnModesRef.current);
	
	const handleSetupComplete = useCallback(() => {
		// Force re-render to show main interface
		setForceUpdate((prev: number) => prev + 1);
	}, []);

	const handleOpenSettings = useCallback(() => {
		// Open Obsidian settings - simplified approach
		if (window.app) {
			try {
				// @ts-ignore - Access Obsidian's settings API
				window.app.setting?.open();
				// @ts-ignore - Navigate to plugin settings if available
				window.app.setting?.openTabById?.('community-plugins');
			} catch (error) {
				console.log('Please open Obsidian Settings > Community Plugins > Life Navigator to configure API keys');
			}
		}
	}, []);

	// Refresh setup state check when component becomes visible or mounts
	useEffect(() => {
		const checkSetupState = () => {
			setForceUpdate((prev: number) => prev + 1);
		};

		// Check immediately when component mounts
		checkSetupState();

		// Also check when window gains focus (user returns to Obsidian)
		window.addEventListener('focus', checkSetupState);
		
		return () => {
			window.removeEventListener('focus', checkSetupState);
		};
	}, []);

	// If setup is not complete, show setup flow
	if (!isSetupCompleted) {
		return (
			<SetupFlow 
				onSetupComplete={handleSetupComplete}
				onOpenSettings={handleOpenSettings}
			/>
		);
	}

	return (
		<div className="life-navigator-view-content">
			<div className="chat-bar">
				<div
					className="chat-bar-title"
					style={{ position: "relative", overflow: "visible" }}
				>
					{/* Flex row for dropdown and menu button */}
					<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
						{activeMode && <div
							className="active-mode-indicator"
							onClick={toggleDropdown}
							style={{
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								gap: "8px",
								padding: "4px",
								borderRadius: "4px",
								transition: "background-color 0.2s ease",
								position: "relative",
								backgroundColor: dropdownOpen
									? "var(--background-modifier-hover)"
									: "transparent",
							}}
							ref={modeIndicatorRef}
						>
							{activeMode.ln_icon && (
								<span
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
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
							<span style={{ fontWeight: 500 }}>
								{activeMode.ln_name}
							</span>
							<span
								style={{
									display: "flex",
									alignItems: "center",
									marginLeft: "4px",
									transform: dropdownOpen
										? "rotate(180deg)"
										: "rotate(0)",
									transition: "transform 0.2s ease",
								}}
							>
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
						</div> }
					</div>

					{/* Mode selection dropdown */}
					{dropdownOpen && (
						<div
							ref={dropdownRef}
							style={{
								position: "absolute",
								top: "38px",
								left: "0",
								zIndex: 99999,
								minWidth: "240px",
								maxWidth: "360px",
								maxHeight: "600px",
								overflowY: "auto",
								backgroundColor: "var(--background-primary)",
								border: "1px solid var(--background-modifier-border)",
								borderRadius: "6px",
								boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
								padding: "4px 0",
								display: "flex",
								flexDirection: "column"
							}}
						>
							{/* Actions */}
							<div
								style={{
									padding: "8px 12px",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									gap: "8px",
									fontSize: "14px",
									color: "var(--text-normal)",
									whiteSpace: "normal",
									wordBreak: "break-word",
								}}
								onClick={() => {
									if (window.app && activeMode.ln_path) {
										const file = window.app.vault.getAbstractFileByPath(activeMode.ln_path);
										if (file) {
											window.app.workspace.getLeaf().openFile(file as TFile);
										}
									}
									setDropdownOpen(false);
								}}
								onMouseOver={e => (e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)")}
								onMouseOut={e => (e.currentTarget.style.backgroundColor = "transparent")}
							>
								<LucideIcon name="external-link" size={16} color="var(--text-normal)" />
								{t('ui.mode.openInEditor')}
							</div>
							<div
								style={{
									padding: "8px 12px",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									gap: "8px",
									fontSize: "14px",
									color: "var(--text-normal)",
									whiteSpace: "normal",
									wordBreak: "break-word",
								}}
								onClick={() => {
									openSimpleObsidianModal(
										window.app,
										t('ui.modal.modeSettings').replace('{{modeName}}', activeMode.ln_name),
										JSON.stringify(activeMode, null, 2)
									);
									setDropdownOpen(false);
								}}
								onMouseOver={e => (e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)")}
								onMouseOut={e => (e.currentTarget.style.backgroundColor = "transparent")}
							>
								<LucideIcon name="settings" size={16} color="var(--text-normal)" /> 
								{t('ui.mode.viewSettings')}
							</div>
							<div
								style={{
									padding: "8px 12px",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									gap: "8px",
									fontSize: "14px",
									color: "var(--text-normal)",
									whiteSpace: "normal",
									wordBreak: "break-word",
								}}
								onClick={async () => {
									const systemPrompt = await getContext();
									openSimpleObsidianModal(
										window.app,
										t('ui.modal.systemPrompt').replace('{{modeName}}', activeMode.ln_name),
										systemPrompt || ""
									);
									setDropdownOpen(false);
								}}
								onMouseOver={e => (e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)")}
								onMouseOut={e => (e.currentTarget.style.backgroundColor = "transparent")}
							>
								<LucideIcon name="terminal" size={16} color="var(--text-normal)" />
								{t('ui.mode.viewSystemPrompt')}
							</div>

							{/* Separator */}
							<div style={{ borderTop: "1px solid var(--background-modifier-border)", margin: "4px 0" }} />

							{/* "switch to" label */}
							<div style={{ padding: "8px 12px", fontSize: "14px", color: "var(--text-muted)", whiteSpace: "normal", wordBreak: "break-word" }}>
								{t('ui.mode.switchTo')}
							</div>

							{/* Mode list */}
							{Object.keys(lnModesRef.current).length > 0 && (
								<>
									{Object.values(lnModesRef.current).map((mode, index) => (
										<div
											key={index}
											style={{
												display: "flex",
												alignItems: "center",
												gap: "8px",
												padding: "8px 12px",
												cursor: "pointer",
												backgroundColor:
													mode.ln_path === activeMode.ln_path
														? "var(--background-modifier-hover)"
														: "transparent",
												position: "relative",
												fontWeight: mode.ln_path === activeMode.ln_path ? 500 : "normal",
												whiteSpace: "normal",
												wordBreak: "break-word",
											}}
											onClick={() => {
												setActiveModeId(mode.ln_path);
												setDropdownOpen(false);
											}}
											onMouseOver={e => (e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)")}
											onMouseOut={e => (e.currentTarget.style.backgroundColor = mode.ln_path === activeMode.ln_path ? "var(--background-modifier-hover)" : "transparent")}
										>
											{mode.ln_icon && (
												<span
													style={{
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<LucideIcon
														name={mode.ln_icon}
														size={16}
														color={mode.ln_icon_color || "var(--text-normal)"}
													/>
												</span>
											)}
											<span
												style={{
													fontSize: "14px",
													whiteSpace: "nowrap",
													overflow: "hidden",
													textOverflow: "ellipsis",
													fontWeight: mode.ln_path === activeMode.ln_path ? 500 : "normal",
												}}
											>
												{mode.ln_name}
											</span>
										</div>
									))}
									
								</>
							)}

							
							<div
								style={{
									padding: "8px 12px",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									gap: "8px",
									fontSize: "14px",
									color: "var(--text-normal)",
									whiteSpace: "normal",
									wordBreak: "break-word",
								}}
								onClick={() => {
									if (window.app) {
										// @ts-ignore - Using the Obsidian command API
										window.app.commands.executeCommandById("life-navigator:create-new-mode");
									}
									setDropdownOpen(false);
								}}
								onMouseOver={e => (e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)")}
								onMouseOut={e => (e.currentTarget.style.backgroundColor = "transparent")}
							>
								<LucideIcon name="plus" size={16} color="var(--text-normal)" />
								{t('ui.mode.newMode')}
							</div>
						</div>
					)}
				</div>
				<div className="chat-bar-actions">
					<button
						className="clickable-icon"
						aria-label={t('ui.chat.new')}
						onClick={clearConversation}
					>
						<LucideIcon name="square-pen" size={18} />
					</button>

					<div style={{ position: "relative" }}>
						<button
							className="clickable-icon"
							aria-label={t('ui.chat.history')}
							onClick={() => setConversationHistoryOpen(!conversationHistoryOpen)}
							ref={conversationHistoryButtonRef}
						>
							<LucideIcon name="history" size={18} />
						</button>

						<ConversationHistoryDropdown
							database={getConversationDatabase()}
							onConversationSelect={handleConversationSelect}
							isOpen={conversationHistoryOpen}
							onToggle={() => setConversationHistoryOpen(!conversationHistoryOpen)}
							currentConversationId={getCurrentConversationId()}
						/>
					</div>
				</div>
			</div>

			<div
				className="conversation-container"
				ref={conversationContainerRef}
			>
				{renderEmptyConversation()}

				{filteredConversation.map((message, index) => (
					<MessageDisplay
						key={`msg-${index}`}
						role={message.role}
						content={message.content}
						toolResults={toolResultsMap}
						messageIndex={filteredToOriginalIndexMap[index]}
						isLastMessage={index === filteredConversation.length - 1}
						isGeneratingResponse={isGeneratingResponse}
						newAbortController={newAbortController}
						abort={abort}
					/>
				))}

				{isGeneratingResponse && <ThinkingMessage status="thinking" />}
			</div>

			{activeMode && <div className="controls-container">
				<div className="button-container">
					<UnifiedInputArea
						newAbortController={newAbortController}
						abort={abort}
						editingMessage={editingMessage}
					/>
				</div>
			</div> }
		</div>
	);
};
