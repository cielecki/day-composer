import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';

const schema = {
	name: 'library_list',
	description: 'Browse the remote Life Navigator library catalog to see available templates, examples, and content that can be downloaded and installed into your vault. This shows what\'s available to install.',
	input_schema: {
		type: 'object',
		properties: {},
		required: []
	}
};

type LibraryListInput = Record<string, never>;

// Life Navigator repository configuration
const LIFE_NAVIGATOR_REPO = 'cielecki/life-navigator';
const INDEX_PATH = 'library/index.md';

export const libraryListTool: ObsidianTool<LibraryListInput> = {
	specification: schema,
	icon: "library",
	get initialLabel() {
		return t('tools.library.list.label');
	},
	execute: async (context: ToolExecutionContext<LibraryListInput>): Promise<void> => {
		try {
			context.setLabel(t('tools.library.list.inProgress'));

			const [owner, repo] = LIFE_NAVIGATOR_REPO.split('/');

			// Fetch the index.md file directly
			const indexUrl = `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/${INDEX_PATH}`;
			const response = await fetch(indexUrl);

			if (!response.ok) {
				throw new ToolExecutionError(`Failed to access library index (HTTP ${response.status})`);
			}

			const indexContent = await response.text();

			context.progress(indexContent);
			context.setLabel(t('tools.library.list.completed'));

		} catch (error) {
			context.setLabel(t('tools.library.list.failed'));
			const errorMessage = error instanceof Error ? error.message : String(error);
			context.progress(`❌ Error: ${errorMessage}`);
			throw error instanceof ToolExecutionError ? error : new ToolExecutionError(errorMessage);
		}
	}
};