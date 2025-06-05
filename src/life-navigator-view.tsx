import { ItemView, WorkspaceLeaf } from "obsidian";
import * as ReactDOM from "react-dom/client";
import { LifeNavigatorApp } from "./components/LifeNavigatorApp";
import { Message } from "./types/chat-types";
import { LifeNavigatorPlugin } from './LifeNavigatorPlugin';
import { t } from './i18n';

export interface LifeNavigatorViewProps {
	plugin: LifeNavigatorPlugin;
	initialMessages?: Message[];
}

export const LIFE_NAVIGATOR_VIEW_TYPE = "life-navigator-view";

export class LifeNavigatorView extends ItemView {
	private reactRoot: ReactDOM.Root | null = null;
	private _conversation: Message[] = [];

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return LIFE_NAVIGATOR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t('view.title');
	}

	getIcon(): string {
		return "compass";
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
	}

	renderComponent(): void {
		if (!this.reactRoot) return;

		console.debug(`Rendering LifeNavigatorView component with conversation: ${this._conversation.length} messages`);

		// Render directly without context providers since we're using Zustand
		this.reactRoot.render(<LifeNavigatorApp />);
	}

	// Add getState and setState methods
	getState(): any {
		return {
			conversation: this._conversation,
		};
	}

	async setState(state: any, result: any): Promise<void> {
		if (state && state.conversation) {
			this._conversation = state.conversation;
			this.renderComponent();
		}
	}

	// Add getter for conversation
	get conversation(): Message[] {
		return this._conversation;
	}
} 