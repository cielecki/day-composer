import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";

const schema = {
	name: 'library_list',
	description: 'Browse and list all available items in the Life Navigator library using the curated index',
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
	initialLabel: t('tools.library.list.label'),
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

		} catch (error) {
			context.setLabel(t('tools.library.list.failed'));
			const errorMessage = error instanceof Error ? error.message : String(error);
			context.progress(`❌ Error: ${errorMessage}`);
			throw error instanceof ToolExecutionError ? error : new ToolExecutionError(errorMessage);
		}
	}
};