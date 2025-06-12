import { ItemView, WorkspaceLeaf } from "obsidian";
import * as ReactDOM from "react-dom/client";
import { t } from '../i18n';
import { SystemPromptApp } from "../components/SystemPromptApp";
import { usePluginStore } from "src/store/plugin-store";
import { updateLeafTitle } from "src/utils/ui/leaf-title-updater";

export interface SystemPromptViewState extends Record<string, unknown> {
	modeId: string;
}

export const SYSTEM_PROMPT_VIEW_TYPE = "system-prompt-view";

export class SystemPromptView extends ItemView {
	private reactRoot: ReactDOM.Root | null = null;
	private modeId: string;
	private boundTitleChangeHandler: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		
		// Create a stable bound function for title changes
		this.boundTitleChangeHandler = this.handleTitleChange.bind(this);
	}

	getViewType(): string {
		return SYSTEM_PROMPT_VIEW_TYPE;
	}

	getDisplayText(): string {
		const modeName = usePluginStore.getState().modes.available[this.modeId]?.name;
		return modeName ? t('systemPrompt.view.title', { modeName }) : t('systemPrompt.view.titleGeneric');
	}

	getIcon(): string {
		return "terminal";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("system-prompt-view");

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

	private handleTitleChange(): void {
		updateLeafTitle(this.leaf, this.getDisplayText());
	}

	renderComponent(): void {
		if (!this.reactRoot || !this.boundTitleChangeHandler || !this.modeId) return;

		// Render the system prompt app with stable function reference and mode ID
		this.handleTitleChange();
		this.reactRoot.render(<SystemPromptApp onTitleChange={this.boundTitleChangeHandler} modeId={this.modeId} />);
	}

	// Add getState and setState methods for persistence
	getState(): SystemPromptViewState {
		return {
			modeId: this.modeId,
		};
	}

	async setState(state: SystemPromptViewState, result: any): Promise<void> {
		this.modeId = state.modeId;
		this.renderComponent();
		return super.setState({
			...state,
		}, result);
	}

	// Method to refresh the view (useful when mode changes)
	refresh(): void {
		this.renderComponent();
	}
} 