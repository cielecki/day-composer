import { App, MarkdownView, TFile } from 'obsidian';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { StateField, StateEffect, Extension } from '@codemirror/state';
import { NavigationTarget } from '../obsidian-tools';

// Effect to add highlighting
const addHighlight = StateEffect.define<{from: number, to: number}>({
	map: ({from, to}, change) => ({from: change.mapPos(from), to: change.mapPos(to)})
});

// Effect to clear highlighting
const clearHighlight = StateEffect.define();

// State field to track highlighting decorations
const highlightField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(highlights, tr) {
		highlights = highlights.map(tr.changes);
		for (let e of tr.effects) {
			if (e.is(addHighlight)) {
				highlights = highlights.update({
					add: [highlightDecoration.range(e.value.from, e.value.to)]
				});
			} else if (e.is(clearHighlight)) {
				highlights = Decoration.none;
			}
		}
		return highlights;
	},
	provide: f => EditorView.decorations.from(f)
});

// Decoration for highlighting with mobile-optimized styles
const highlightDecoration = Decoration.mark({
	class: "life-navigator-highlight"
});

// Extension that includes the highlighting system
export const highlightExtension: Extension = [highlightField];

/**
 * Service for handling editor navigation and line highlighting
 */
export class EditorNavigationService {
	private app: App;
	private highlightTimeouts: Map<EditorView, NodeJS.Timeout> = new Map();

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Check if we're on a mobile device
	 */
	private isMobile(): boolean {
		return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	}

	/**
	 * Check if we're on iOS
	 */
	private isIOS(): boolean {
		return /iPad|iPhone|iPod/.test(navigator.userAgent);
	}

	/**
	 * Navigate to a specific target (file and optionally highlight lines)
	 */
	async navigateToTarget(target: NavigationTarget): Promise<void> {
		try {
			console.debug('Navigating to target:', target);
			
			// Get the file
			const file = this.app.vault.getAbstractFileByPath(target.filePath);
			if (!file || !(file instanceof TFile)) {
				console.error(`File not found: ${target.filePath}`);
				return;
			}

			// Open the file
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			// If we have a line range, highlight it
			if (target.lineRange) {
				await this.highlightLines(target.lineRange.start, target.lineRange.end);
			}
		} catch (error) {
			console.error('Error navigating to target:', error);
		}
	}

	/**
	 * Highlight specific lines in the active editor
	 */
	private async highlightLines(startLine: number, endLine: number): Promise<void> {
		// Wait a bit for the file to load
		await new Promise(resolve => setTimeout(resolve, 200));

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			console.error('No active markdown view found');
			return;
		}

		try {
			// Get the CodeMirror 6 editor instance
			const editorView = (activeView.editor as any).cm as EditorView;
			if (!editorView) {
				console.error('Could not access CodeMirror editor');
				return;
			}

			// Ensure the highlight extension is installed
			this.ensureHighlightExtension(editorView);

			// Get line positions (CodeMirror uses 1-based line numbers)
			const doc = editorView.state.doc;
			const startLineInfo = doc.line(Math.max(1, Math.min(startLine, doc.lines)));
			const endLineInfo = doc.line(Math.max(1, Math.min(endLine, doc.lines)));

			// Create selection range
			let from = startLineInfo.from;
			let to = endLineInfo.to;

			// Ensure we have a valid range (not empty)
			if (from >= to) {
				// If the range is empty or invalid, expand it to include at least one character
				// This can happen with empty lines or single-character lines
				to = Math.max(from + 1, doc.length);
				console.debug(`Adjusted empty range: from=${from}, to=${to}`);
			}

			console.debug(`Highlighting lines ${startLine}-${endLine} (positions ${from}-${to})`);

			// Clear any existing highlights first
			editorView.dispatch({
				effects: clearHighlight.of(null)
			});

			// Add decoration-based highlighting for better mobile visibility
			editorView.dispatch({
				effects: addHighlight.of({from, to})
			});

			// Set selection and scroll to ensure visibility
			// Use proper scrollIntoView with options for better positioning
			const scrollOptions = this.getScrollOptions();
			
			editorView.dispatch({
				//selection: { head: from, anchor: to },
				effects: [
					// Use EditorView.scrollIntoView with proper positioning
					EditorView.scrollIntoView(from, scrollOptions)
				]
			});

			// On mobile, add additional scroll handling to ensure visibility
			if (this.isMobile()) {
				this.ensureMobileVisibility(editorView, from, to);
			}

			// Clear existing timeout for this editor
			const existingTimeout = this.highlightTimeouts.get(editorView);
			if (existingTimeout) {
				clearTimeout(existingTimeout);
			}

			// Set timeout to clear highlighting after 3 seconds
			const timeout = setTimeout(() => {
				try {
					editorView.dispatch({
						effects: clearHighlight.of(null),
						//selection: { head: from, anchor: from }
					});
					this.highlightTimeouts.delete(editorView);
				} catch (error) {
					// Ignore errors if editor is no longer available
				}
			}, 1000);

			this.highlightTimeouts.set(editorView, timeout);

		} catch (error) {
			console.error('Error highlighting lines:', error);
		}
	}

	/**
	 * Get scroll options optimized for different devices
	 */
	private getScrollOptions(): {y: "start" | "center" | "end" | "nearest", yMargin: number} {
		if (this.isMobile()) {
			// On mobile, position highlighted text in the top third of the screen
			// to avoid virtual keyboards and give more context
			return {
				y: 'start' as const,  // Scroll the highlighted text to the top portion of viewport
				yMargin: 60  // Add margin so it's not right at the edge
			};
		} else {
			// On desktop, center the highlighted text for better visibility
			return {
				y: 'center' as const, // Center the highlighted text in the viewport
				yMargin: 20  // Smaller margin on desktop
			};
		}
	}

	/**
	 * Ensure highlighted text is visible on mobile devices with additional checks
	 */
	private ensureMobileVisibility(editorView: EditorView, from: number, to: number): void {
		// Use requestAnimationFrame to allow the scroll to complete first
		requestAnimationFrame(() => {
			try {
				// Check if the highlighted area is actually visible
				const coords = editorView.coordsAtPos(from);
				if (!coords) {
					console.warn('Could not get coordinates for highlighted position');
					return;
				}

				const viewport = editorView.viewport;
				const scrollDOM = editorView.scrollDOM;
				const editorRect = scrollDOM.getBoundingClientRect();

				// Check if the highlighted text is within the visible area
				const isVisible = coords.top >= editorRect.top && 
								coords.bottom <= editorRect.bottom;

				if (!isVisible) {
					console.debug('Highlighted text not visible, attempting additional scroll');
					
					// If still not visible, try a more aggressive scroll
					editorView.dispatch({
						effects: [
							EditorView.scrollIntoView(from, {
								y: 'start' as const,
								yMargin: 80 // Larger margin to ensure visibility
							})
						]
					});
				}
			} catch (error) {
				console.warn('Error ensuring mobile visibility:', error);
			}
		});
	}

	/**
	 * Handle mobile-specific selection with iOS fixes
	 */
	private handleMobileSelection(editorView: EditorView, from: number, to: number): void {
		// This method is now replaced by the improved scrolling logic above
		// Keeping it for backward compatibility but it's no longer used
		if (this.isIOS()) {
			// iOS-specific handling: focus first, then select
			const domElement = editorView.dom as HTMLElement;
			domElement.focus();
			
			// Use requestAnimationFrame to ensure proper timing
			requestAnimationFrame(() => {
				try {
					editorView.dispatch({
						selection: { head: from, anchor: to },
						effects: [EditorView.scrollIntoView(from, this.getScrollOptions())]
					});
				} catch (error) {
					console.warn('iOS selection fallback failed:', error);
				}
			});
		} else {
			// Android and other mobile devices
			editorView.dispatch({
				selection: { head: from, anchor: to },
				effects: [EditorView.scrollIntoView(from, this.getScrollOptions())]
			});
		}
	}

	/**
	 * Ensure the highlight extension is installed in the editor
	 */
	private ensureHighlightExtension(editorView: EditorView): void {
		const state = editorView.state;
		
		// Check if our extension is already installed
		const hasExtension = state.field(highlightField, false) !== undefined;
		
		if (!hasExtension) {
			// Add our extension to the editor
			editorView.dispatch({
				effects: StateEffect.appendConfig.of(highlightExtension)
			});
		}
	}

	/**
	 * Clean up timeouts when the service is destroyed
	 */
	destroy(): void {
		for (const timeout of this.highlightTimeouts.values()) {
			clearTimeout(timeout);
		}
		this.highlightTimeouts.clear();
	}
}

// Singleton instance
let editorNavigationService: EditorNavigationService | null = null;

export function getEditorNavigationService(app: App): EditorNavigationService {
	if (!editorNavigationService) {
		editorNavigationService = new EditorNavigationService(app);
	}
	return editorNavigationService;
} 