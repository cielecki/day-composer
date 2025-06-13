import { LifeNavigatorPlugin } from 'src/LifeNavigatorPlugin';
import { NavigationTarget } from 'src/obsidian-tools';

// Tool Execution Context for the new context-based tool system

export interface ToolExecutionContext<TInput = Record<string, unknown>> {
	// Execution environment
	plugin: LifeNavigatorPlugin;
	params: TInput;
	signal: AbortSignal;
	chatId: string; // Current chat ID for per-chat operations

	// Progress reporting (final message serves as result)
	progress(message: string): void;

	// Navigation targets (can be called multiple times during execution)
	addNavigationTarget(target: NavigationTarget): void;

	// Action text/label management (updates the tool's display text in chat)
	setLabel(text: string): void;
}
