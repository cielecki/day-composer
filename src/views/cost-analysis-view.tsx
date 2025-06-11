import { ItemView, WorkspaceLeaf } from "obsidian";
import * as ReactDOM from "react-dom/client";
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { t } from '../i18n';
import { CostAnalysisApp } from "src/components/CostAnalysisApp";

export interface CostAnalysisViewProps {
	plugin: LifeNavigatorPlugin;
	conversationId: string;
}

export const COST_ANALYSIS_VIEW_TYPE = "cost-analysis-view";

export class CostAnalysisView extends ItemView {
	private reactRoot: ReactDOM.Root | null = null;
	private conversationId: string | null = null;
	private conversationTitle: string = "";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return COST_ANALYSIS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.conversationTitle;
	}

	getIcon(): string {
		return "dollar-sign";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("cost-analysis-view");

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

		console.debug(`Rendering CostAnalysisView component for conversation: ${this.conversationId || 'none'}`);

        if (!this.conversationId) {
            // Show error message when no conversation ID is provided
            this.reactRoot.render(
                <div style={{padding: '20px', textAlign: 'center'}}>
                    <h3>{t('costAnalysis.errors.noConversationSpecified')}</h3>
                    <p>{t('costAnalysis.errors.requiresConversationId')}</p>
                </div>
            );
            return;
        }

        const setConversationTitle = (title: string): void => {
            this.conversationTitle = title;
            
            this.leaf.setViewState({
                type: COST_ANALYSIS_VIEW_TYPE,
                active: true,
                state: {
                    conversationId: this.conversationId,
                    conversationTitle: title
                }
            });
        };

		// Render the cost analysis app
		this.reactRoot.render(<CostAnalysisApp conversationId={this.conversationId} onTitleChange={setConversationTitle.bind(this)} />);
	}

	// Add getState and setState methods for persistence
	getState(): any {
		return {
			conversationId: this.conversationId,
			conversationTitle: this.conversationTitle,
		};
	}

	async setState(state: any, result: any): Promise<void> {
		if (state && state.conversationId !== undefined) {
			this.conversationId = state.conversationId;
			this.conversationTitle = state.conversationTitle || "";
			this.renderComponent();
		}
		return super.setState(state, result);
	}

	// Method to set conversation ID and title programmatically
	setConversationId(conversationId: string | null, conversationTitle?: string): void {
		this.conversationId = conversationId;
		this.conversationTitle = conversationTitle || "";
		this.renderComponent();
	}
} 