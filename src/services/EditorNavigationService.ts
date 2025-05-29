import { App, MarkdownView, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { NavigationTarget } from '../obsidian-tools';

/**
 * Service for handling editor navigation and line highlighting
 */
export class EditorNavigationService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Navigate to a specific target (file and optionally highlight lines)
	 */
	async navigateToTarget(target: NavigationTarget): Promise<void> {
		try {
			console.log('Navigating to target:', target);
			
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
		await new Promise(resolve => setTimeout(resolve, 150));

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

			// Get line positions (CodeMirror uses 1-based line numbers)
			const doc = editorView.state.doc;
			const startLineInfo = doc.line(Math.max(1, Math.min(startLine, doc.lines)));
			const endLineInfo = doc.line(Math.max(1, Math.min(endLine, doc.lines)));

			// Create selection range
			const from = startLineInfo.from;
			const to = endLineInfo.to;

			console.log(`Highlighting lines ${startLine}-${endLine} (positions ${from}-${to})`);

			// Dispatch the selection and scroll into view
			editorView.dispatch({
				selection: { head: from, anchor: to },
				scrollIntoView: true
			});

			// Add a temporary highlight effect
			this.addTemporaryHighlight(editorView, from, to);
		} catch (error) {
			console.error('Error highlighting lines:', error);
		}
	}

	/**
	 * Add a temporary visual highlight effect
	 */
	private addTemporaryHighlight(editorView: EditorView, from: number, to: number): void {
		// This could be enhanced with CodeMirror decorations for a more sophisticated highlight
		// For now, the selection itself provides the highlighting
		
		// Optional: Clear selection after a delay to just show the cursor position
		setTimeout(() => {
			try {
				editorView.dispatch({
					selection: { head: from, anchor: from }
				});
			} catch (error) {
				// Ignore errors if editor is no longer available
			}
		}, 2000);
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