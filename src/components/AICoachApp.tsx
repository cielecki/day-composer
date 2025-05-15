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
import { useAICMode } from "../context/AICModeContext";
import {
	ToolResultBlock,
	ContentBlock,
} from "src/types/types";
import { useAIAgent } from "src/context/AIAgentContext";
import { LucideIcon } from "./LucideIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AICModePill } from "./AICModePills";
import { TFile } from "obsidian";
import { Modal } from "obsidian";
import { t } from '../i18n';
import { UnifiedInputArea } from "./UnifiedInputArea";

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
			const button = contentEl.createEl("button", { text: t('ui.modal.copyToClipboard'), cls: "mod-cta" });
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

export const AICoachApp: React.FC = () => {
	const [abortController, setAbortController] =
		useState<AbortController | null>(null);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const modeIndicatorRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const {
		conversation,
		clearConversation,
		isGeneratingResponse,
		addUserMessage,
		getContext
	} = useAIAgent();

	// Use AICModes context
	const { aicModes, activeModeId,setActiveMode } = useAICMode();
	const activeMode = aicModes[activeModeId];

	const conversationContainerRef = useRef<HTMLDivElement>(null);

	const { isPlayingAudio } = useTextToSpeech();

	// Build a map of tool results (tool_use_id -> result content)
	const toolResultsMap = useMemo(() => {
		const resultsMap = new Map<string, string>();

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
							toolResult.content,
						);
					}
				});
			}
		});

		return resultsMap;
	}, [conversation]);

	// Filter out user messages that contain only tool results
	const filteredConversation = useMemo(() => {
		return conversation.filter((message) => {
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

	// Effect to scroll to bottom when conversation history updates
	useEffect(() => {
		scrollToBottom();
	}, [filteredConversation, scrollToBottom]);

	const newAbortController = useCallback(() => {
		const abortController = new AbortController();
		setAbortController(abortController);
		return abortController;
	}, [setAbortController]);

	const abort = useCallback(() => {
		if (abortController) {
			abortController.abort();
			setAbortController(null);
		}
	}, [abortController, setAbortController]);

	// Function to handle AIC mode selection
	const handleModeSelect = useCallback(
		(modeId: string): void => {
			// Set the active mode using the ID
			const mode = aicModes[modeId];
			if (mode) {
				setActiveMode(mode);
			}
		},
		[aicModes, setActiveMode],
	);

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
							{activeMode.aic_description}
						</ReactMarkdown>
					</div>

						{Object.keys(aicModes).length === 1 && (
							<button
								className="mod-cta"
								onClick={() => {
									if (window.app) {
										// @ts-ignore - Using the Obsidian command API
										window.app.commands.executeCommandById(
											"mc-tools-obsidian:create-starter-pack",
										);
									}
								}}
							>
								{t('ui.mode.createStarterPack')}
							</button>
						)}

					{activeMode.aic_example_usages.length > 0 && (
						<div className="aic-mode-pills-container">
							{activeMode.aic_example_usages.map((usage, index) => (
								<AICModePill
									key={index}
									id={`${index}`}
									name={usage}
									onClick={() => {
										// If the mode has an auto-trigger message, send it
										if (usage) {
											console.log(
												`Auto-triggering message for mode ${activeMode.aic_name}: "${usage}"`,
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

	return (
		<div className="ai-coach-view-content">
			<div className="chat-bar">
				<div
					className="chat-bar-title"
					style={{ position: "relative", overflow: "visible" }}
				>
					{/* Flex row for dropdown and menu button */}
					<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
						<div
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
							{activeMode.aic_icon && (
								<span
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<LucideIcon
										name={activeMode.aic_icon}
										size={18}
										color={
											activeMode.aic_icon_color ||
											"var(--text-normal)"
										}
									/>
								</span>
							)}
							<span style={{ fontWeight: 500 }}>
								{activeMode.aic_name}
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
						</div>
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
									if (window.app && activeMode.aic_path) {
										const file = window.app.vault.getAbstractFileByPath(activeMode.aic_path);
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
										t('ui.modal.modeSettings').replace('{{modeName}}', activeMode.aic_name),
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
										t('ui.modal.systemPrompt').replace('{{modeName}}', activeMode.aic_name),
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
							{Object.keys(aicModes).length > 0 && (
								<>
									{Object.values(aicModes).map((mode, index) => (
										<div
											key={index}
											style={{
												display: "flex",
												alignItems: "center",
												gap: "8px",
												padding: "8px 12px",
												cursor: "pointer",
												backgroundColor:
													mode.aic_path === activeMode.aic_path
														? "var(--background-modifier-hover)"
														: "transparent",
												position: "relative",
												fontWeight: mode.aic_path === activeMode.aic_path ? 500 : "normal",
												whiteSpace: "normal",
												wordBreak: "break-word",
											}}
											onClick={() => {
												handleModeSelect(mode.aic_path);
												setDropdownOpen(false);
											}}
											onMouseOver={e => (e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)")}
											onMouseOut={e => (e.currentTarget.style.backgroundColor = mode.aic_path === activeMode.aic_path ? "var(--background-modifier-hover)" : "transparent")}
										>
											{mode.aic_icon && (
												<span
													style={{
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<LucideIcon
														name={mode.aic_icon}
														size={16}
														color={mode.aic_icon_color || "var(--text-normal)"}
													/>
												</span>
											)}
											<span
												style={{
													fontSize: "14px",
													whiteSpace: "nowrap",
													overflow: "hidden",
													textOverflow: "ellipsis",
													fontWeight: mode.aic_path === activeMode.aic_path ? 500 : "normal",
												}}
											>
												{mode.aic_name}
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
										window.app.commands.executeCommandById("mc-tools-obsidian:create-single-mode");
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

					<button
						className="chat-bar-button"
						aria-label={t('ui.chat.history')}
						style={{ display: "none" }}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<circle cx="12" cy="12" r="10"></circle>
							<polyline points="12 6 12 12 16 14"></polyline>
						</svg>
					</button>
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
						messageIndex={index}
						isLastMessage={index === filteredConversation.length - 1}
						isGeneratingResponse={isGeneratingResponse}
					/>
				))}

				{isGeneratingResponse && <ThinkingMessage status="thinking" />}
			</div>

			<div className="controls-container">
				<div className="button-container">
					<UnifiedInputArea
						newAbortController={newAbortController}
						abort={abort}
					/>
				</div>
			</div>
		</div>
	);
};
