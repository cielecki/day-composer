import { ItemView, WorkspaceLeaf } from "obsidian";
import * as ReactDOM from "react-dom/client";
import { ChatApp } from "../components/ChatApp";
import { Message } from "../types/message";
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { t } from '../i18n';
import { usePluginStore } from '../store/plugin-store';

export interface ChatViewState {
	chatId: string;
}

export interface ChatViewProps {
	plugin: LifeNavigatorPlugin;
	initialMessages?: Message[];
}

export const LIFE_NAVIGATOR_VIEW_TYPE = "life-navigator-view";

export class ChatView extends ItemView {
	private reactRoot: ReactDOM.Root | null = null;
	private _chatId: string;

	constructor(leaf: WorkspaceLeaf, chatId?: string) {
		super(leaf);
		
		// If no chatId provided, create a new chat
		if (chatId) {
			this._chatId = chatId;
		} else {
			// Create a new chat using the current active mode
			const store = usePluginStore.getState();
			this._chatId = store.createNewChat();
		}
	}

	getViewType(): string {
		return LIFE_NAVIGATOR_VIEW_TYPE;
	}

	getDisplayText(): string {
		// Try to get the chat title from the store
		const store = usePluginStore.getState();
		const chatState = store.getChatState(this._chatId);
		
		if (chatState && chatState.chat.storedConversation.title) {
			return chatState.chat.storedConversation.title;
		}
		
		return t('view.title');
	}

	getIcon(): string {
		return "compass";
	}

	getChatId(): string {
		return this._chatId;
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("life-navigator-view");

		// Create a container for React
		const reactContainer = container.createDiv({ cls: "react-container" });

		// Create React root
		this.reactRoot = ReactDOM.createRoot(reactContainer);

		this.renderComponent();
	}

	async onClose(): Promise<void> {
		if (this.reactRoot) {
			this.reactRoot.unmount();
			this.reactRoot = null;
		}

		// Optional: Unload the chat from memory if no other views are using it
		// This could be configurable behavior
		// const store = usePluginStore.getState();
		// store.unloadChat(this._chatId);
	}

	renderComponent(): void {
		if (!this.reactRoot) return;

		console.debug(`Rendering ChatView component with chatId: ${this._chatId}`);

		// Render the ChatApp with the specific chatId
		this.reactRoot.render(<ChatApp chatId={this._chatId} />);
	}

	// State management for the view
	getState(): Record<string, unknown> {
		return {
			chatId: this._chatId,
		};
	}

	async setState(state: Record<string, unknown>, result: any): Promise<void> {
		if (state && typeof state.chatId === 'string') {
			// Ensure the chat exists or create it
			const store = usePluginStore.getState();
			let chatState = store.getChatState(state.chatId);
			
			if (!chatState) {
				// Try to load from database first
				const loaded = await store.loadChat(state.chatId);
				if (!loaded) {
					// Create a new chat with this ID (this might happen during view restoration)
					console.warn(`Chat ${state.chatId} not found, creating new chat`);
					this._chatId = store.createNewChat();
					this.renderComponent();
					return;
				}
			}
			
			this._chatId = state.chatId;
			this.renderComponent();
		}
	}

	// Update chat ID and re-render
	updateChatId(newChatId: string): void {
		this._chatId = newChatId;
		this.renderComponent();
		
		// Update the leaf view to trigger title refresh
		this.leaf.view = this;
	}
} 