import { ItemView, WorkspaceLeaf } from "obsidian";
import * as ReactDOM from "react-dom/client";
import { LifeNavigatorApp } from "./components/LifeNavigatorApp";
import { Message } from "./types/types";
import { AIAgentProvider } from "./context/AIAgentContext";
import { SpeechToTextProvider } from "./context/SpeechToTextContext";
import MyPlugin from "./main";
import { TextToSpeechProvider } from "./context/TextToSpeechContext";
import { LNModeProvider } from "./context/LNModeContext";
import { t } from './i18n';
import { ConversationDatabase } from "./services/conversation-database";

export interface LifeNavigatorViewProps {
	plugin: MyPlugin;
	initialMessages?: Message[];
}

export const LIFE_NAVIGATOR_VIEW_TYPE = "life-navigator-view";

export class LifeNavigatorView extends ItemView {
	private reactRoot: ReactDOM.Root | null = null;
	private props: LifeNavigatorViewProps;
	private _conversation: Message[] = [];
	private conversationDatabase: ConversationDatabase;

	constructor(leaf: WorkspaceLeaf, props: LifeNavigatorViewProps) {
		super(leaf);
		this.props = props;
		this._conversation = props.initialMessages || [];

		if (!this.props.plugin.manifest.dir) {
			throw new Error('Plugin directory not available');
		}

		this.conversationDatabase = new ConversationDatabase(this.app, this.props.plugin.manifest.dir);
		this.conversationDatabase.initialize().then(() => {
			console.log('Conversation database and naming service initialized');
		});
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
		// Clean up resources
		console.log("View closing, cleaning up resources");

		// Clean up React component
		if (this.reactRoot) {
			this.reactRoot.unmount();
			this.reactRoot = null;
		}
	}

	renderComponent(): void {
		if (!this.reactRoot) return;

		console.log(`Rendering LifeNavigatorView component with conversation: ${this._conversation.length} messages`);

		this.reactRoot.render(
			<LNModeProvider app={this.app}>
				<TextToSpeechProvider>
					<SpeechToTextProvider>
						<AIAgentProvider plugin={this.props.plugin} conversationDatabase={this.conversationDatabase}>
							<LifeNavigatorApp />
						</AIAgentProvider>
					</SpeechToTextProvider>
				</TextToSpeechProvider>
			</LNModeProvider>
		);
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