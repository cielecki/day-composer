import React, {
	createContext,
	useContext,
	useState,
	ReactNode,
	useCallback,
	useRef,
	useEffect,
} from "react";
import { Notice } from "obsidian";
import type MyPlugin from "../main";
import { useTextToSpeech } from "./TextToSpeechContext";
import { useSpeechToText } from "./SpeechToTextContext";
import { Message, ContentBlock } from "../utils/chat/types";
import { useLNMode } from "./LNModeContext";
import { t } from '../i18n';
import { ConversationDatabase } from "../services/conversation-database";
import { Conversation } from '../utils/chat/conversation';
import { generateConversationId } from "../utils/chat/generate-conversation-id";
import { App } from "obsidian";
import { expandLinks } from "../utils/links/expand-links";

// Import utility functions
import { ensureContentBlocks } from "../utils/chat/content-blocks";
import { cleanupLastMessage } from "../utils/chat/message-validation";
import { runConversationTurn, ConversationTurnContext } from "../utils/chat/conversation-turn";
import { handleTTS, TTSContext } from "../utils/chat/tts-integration";
import { 
	autoSaveConversation, 
	saveConversationImmediately,
	saveCurrentConversation as saveConversationUtil,
	loadConversation as loadConversationUtil,
	ConversationPersistenceContext
} from "../utils/chat/conversation-persistence";
import { createUserMessage, extractUserMessageContent } from "../utils/chat/message-builder";
import { getObsidianTools } from "../obsidian-tools";

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
	saveCurrentConversation: (title?: string, tags?: string[]) => Promise<string | null>;
	loadConversation: (conversationId: string) => Promise<boolean>;
	getCurrentConversationId: () => string | null;
	getConversationDatabase: () => ConversationDatabase;
}

const AIAgentContext = createContext<AIAgentContextType | undefined>(undefined);

export const AIAgentProvider: React.FC<{
	children?: ReactNode;
	conversationDatabase: ConversationDatabase;
	plugin: MyPlugin;
}> = ({ children, plugin, conversationDatabase }) => {
	const [_, setForceUpdate] = useState(0);
	const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
	const [editingMessage, setEditingMessage] = useState<{ index: number; content: string; images?: any[] } | null>(null);
	const textToSpeech = useTextToSpeech();
	const { isRecording } = useSpeechToText();
	const { activeModeIdRef, lnModesRef } = useLNMode();
	const app = plugin.app;

	// Conversation database and tracking
	const currentConversationRef = useRef<Conversation>({
		meta: {
			id: generateConversationId(),
			title: "",
			filePath: "",
			updatedAt: 0
		},
		storedConversation: {
			version: 0,
			modeId: "",
			titleGenerated: false,
			messages: []
		}
	});
	const conversationChangedRef = useRef<boolean>(false);
	const [conversationVersion, setConversationVersion] = useState(0);

	// Auto-save conversation when it changes (debounced)
	useEffect(() => {
		const saveTimeout = setTimeout(async () => {
			const persistenceContext: ConversationPersistenceContext = {
				conversationDatabase,
				getCurrentConversation: () => currentConversationRef.current,
				activeModeIdRef,
				lnModesRef
			};
			
			await autoSaveConversation(persistenceContext, isGeneratingResponse);
			conversationChangedRef.current = false;
		}, 2000);

		return () => clearTimeout(saveTimeout);
	}, [conversationVersion, isGeneratingResponse]);

	const triggerConversationChange = useCallback(() => {
		conversationChangedRef.current = true;
		setConversationVersion(prev => prev + 1);
	}, []);

	const clearConversation = useCallback(() => {
		currentConversationRef.current = {
			meta: {
				id: generateConversationId(),
				title: "",
				filePath: "",
				updatedAt: 0
			},
			storedConversation: {
				version: 0,
				modeId: "",
				titleGenerated: false,
				messages: []
			}
		};
		conversationChangedRef.current = false;
		setForceUpdate((prev) => prev + 1);
	}, []);

	const addMessageToConversation = useCallback((message: Message) => {
		currentConversationRef.current.storedConversation.messages = [
			...currentConversationRef.current.storedConversation.messages,
			message
		];
		setForceUpdate((prev) => prev + 1);
		triggerConversationChange();
	}, [triggerConversationChange]);

	const updateLastMessage = useCallback((message: Message) => {
		const messages = currentConversationRef.current.storedConversation.messages;
		if (messages.length > 0) {
			messages[messages.length - 1] = message;
			setForceUpdate((prev) => prev + 1);
		}
	}, []);

	const getContext = useCallback(async (): Promise<string> => {
		const currentActiveMode = lnModesRef.current[activeModeIdRef.current];
		return (await expandLinks(app, currentActiveMode.ln_system_prompt)).trim();
	}, [lnModesRef, activeModeIdRef, app]);

	const addUserMessage = useCallback(
		async (userMessage: string, signal: AbortSignal, images?: any[]): Promise<void> => {
			try {
				// Create and add user message
				const newMessage = createUserMessage(userMessage, images);
				if (newMessage.content.length > 0) {
					addMessageToConversation(newMessage);
					setIsGeneratingResponse(true);

					try {
						// Prepare context and tools
						const systemPrompt = await getContext();
						const obsidianTools = getObsidianTools(plugin);
						const currentActiveMode = lnModesRef.current[activeModeIdRef.current];
						const tools = currentActiveMode 
							? obsidianTools.getToolsForMode(currentActiveMode) 
							: obsidianTools.getTools();

						// Set up conversation turn context
						const turnContext: ConversationTurnContext = {
							messages: currentConversationRef.current.storedConversation.messages,
							addMessage: addMessageToConversation,
							updateMessage: updateLastMessage,
							lnModesRef,
							activeModeIdRef,
							plugin,
							setIsGeneratingResponse,
							onConversationChange: () => {
								const persistenceContext: ConversationPersistenceContext = {
									conversationDatabase,
									getCurrentConversation: () => currentConversationRef.current,
									activeModeIdRef,
									lnModesRef
								};
								saveConversationImmediately(persistenceContext);
							}
						};

						// Run conversation turn
						const finalAssistantMessage = await runConversationTurn(
							systemPrompt,
							tools,
							signal,
							turnContext
						);

						// Handle TTS
						const ttsContext: TTSContext = {
							textToSpeech,
							lnModesRef,
							activeModeIdRef,
							isRecording
						};
						await handleTTS(finalAssistantMessage, signal, ttsContext);

					} catch (error) {
						console.error("Error in conversation turn:", error);
						new Notice(t('errors.setup', { error: error instanceof Error ? error.message : "Unknown error" }));
						setIsGeneratingResponse(false);
					}
				}
			} catch (error) {
				console.error("Error preparing conversation turn:", error);
				new Notice(t('errors.setup', { error: error instanceof Error ? error.message : "Unknown error" }));
				setIsGeneratingResponse(false);
			}
		},
		[
			addMessageToConversation,
			getContext,
			plugin,
			lnModesRef,
			activeModeIdRef,
			textToSpeech,
			isRecording,
			updateLastMessage
		],
	);

	const editUserMessage = useCallback(
		async (messageIndex: number, newContent: string, signal: AbortSignal, images?: any[]): Promise<void> => {
			// Validate message index
			if (messageIndex < 0 || messageIndex >= currentConversationRef.current.storedConversation.messages.length) {
				console.error(`Invalid message index for editing: ${messageIndex}`);
				return;
			}

			const targetMessage = currentConversationRef.current.storedConversation.messages[messageIndex];
			if (targetMessage.role !== "user") {
				console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
				return;
			}

			// Abort current generation if any
			if (isGeneratingResponse) {
				setIsGeneratingResponse(false);
			}

			// Truncate conversation and update the edited message
			const conversationUpToEdit = currentConversationRef.current.storedConversation.messages.slice(0, messageIndex + 1);
			const newMessage = createUserMessage(newContent, images);
			conversationUpToEdit[messageIndex] = newMessage;
			
			currentConversationRef.current.storedConversation.messages = conversationUpToEdit;
			setForceUpdate(prev => prev + 1);
			setEditingMessage(null);

			// Trigger new AI response if there's content
			if (newMessage.content.length > 0) {
				await addUserMessage("", signal); // This will trigger the AI response
			}
		},
		[addUserMessage, isGeneratingResponse]
	);

	const startEditingMessage = useCallback((messageIndex: number) => {
		if (messageIndex < 0 || messageIndex >= currentConversationRef.current.storedConversation.messages.length) {
			console.error(`Invalid message index for editing: ${messageIndex}`);
			return;
		}

		const targetMessage = currentConversationRef.current.storedConversation.messages[messageIndex];
		if (targetMessage.role !== "user") {
			console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
			return;
		}

		const { text, images } = extractUserMessageContent(targetMessage);
		setEditingMessage({
			index: messageIndex,
			content: text,
			images: images
		});
	}, []);

	const cancelEditingMessage = useCallback(() => {
		setEditingMessage(null);
	}, []);

	// Conversation persistence methods
	const saveCurrentConversation = useCallback(async (title?: string, tags?: string[]): Promise<string | null> => {
		const persistenceContext: ConversationPersistenceContext = {
			conversationDatabase,
			getCurrentConversation: () => currentConversationRef.current,
			activeModeIdRef,
			lnModesRef
		};
		
		return await saveConversationUtil(persistenceContext, title, tags);
	}, [activeModeIdRef, lnModesRef]);

	const loadConversation = useCallback(async (conversationId: string): Promise<boolean> => {
		const persistenceContext: ConversationPersistenceContext = {
			conversationDatabase,
			getCurrentConversation: () => currentConversationRef.current,
			activeModeIdRef,
			lnModesRef
		};
		
		const success = await loadConversationUtil(
			persistenceContext,
			conversationId,
			(conversation: Conversation) => {
				currentConversationRef.current = conversation;
				conversationChangedRef.current = false;
				setForceUpdate((prev) => prev + 1);
			}
		);
		
		return success;
	}, [activeModeIdRef, lnModesRef]);

	const getCurrentConversationId = useCallback((): string | null => {
		return currentConversationRef.current?.meta.id || null;
	}, []);

	const getConversationDatabase = useCallback((): ConversationDatabase => {
		return conversationDatabase;
	}, []);

	const value: AIAgentContextType = {
		conversation: currentConversationRef.current?.storedConversation.messages || [],
		clearConversation,
		addUserMessage,
		editUserMessage,
		getContext,
		reset: clearConversation,
		isGeneratingResponse,
		editingMessage,
		startEditingMessage,
		cancelEditingMessage,
		saveCurrentConversation,
		loadConversation,
		getCurrentConversationId,
		getConversationDatabase
	}
	
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
