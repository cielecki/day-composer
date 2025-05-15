import { ItemView, WorkspaceLeaf } from "obsidian";
import * as ReactDOM from "react-dom/client";
import { AICoachApp } from "./components/AICoachApp";
import { Message } from "./types/types";
import { AIAgentProvider } from "./context/AIAgentContext";
import { SpeechToTextProvider } from "./context/SpeechToTextContext";
import MyPlugin from "./main";
import { TextToSpeechProvider } from "./context/TextToSpeechContext";
import { AICModeProvider } from "./context/AICModeContext";
import { t } from './i18n';

export interface AICoachViewProps {
	plugin: MyPlugin;
	initialMessages?: Message[];
}

export const AI_COACH_VIEW_TYPE = "ai-coach-view";

export class AICoachView extends ItemView {
	private reactRoot: ReactDOM.Root | null = null;
	private props: AICoachViewProps;
	private _conversation: Message[] = [];

	constructor(leaf: WorkspaceLeaf, props: AICoachViewProps) {
		super(leaf);
		this.props = props;
		this._conversation = props.initialMessages || [];
	}

	getViewType(): string {
		return AI_COACH_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t('view.title');
	}

	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("ai-coach-view");

		// Create a container for React
		const reactContainer = container.createDiv({ cls: "react-container" });

		// Create React root
		this.reactRoot = ReactDOM.createRoot(reactContainer);

		this.renderComponent();
	}

	async onClose(): Promise<void> {
		// Clean up resources
		console.log(t('logs.view.closing'));

		// Clean up React component
		if (this.reactRoot) {
			this.reactRoot.unmount();
			this.reactRoot = null;
		}
	}

	renderComponent(): void {
		if (!this.reactRoot) return;

		console.log(t('logs.view.rendering').replace('{{count}}', this._conversation.length.toString()));

		this.reactRoot.render(
			<TextToSpeechProvider>
				<AICModeProvider app={this.app}>
					<AIAgentProvider plugin={this.props.plugin}>
						<SpeechToTextProvider>
							<AICoachApp />
						</SpeechToTextProvider>
					</AIAgentProvider>
				</AICModeProvider>
			</TextToSpeechProvider>,
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
