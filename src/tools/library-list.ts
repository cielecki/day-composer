import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { 
	isLocalDevelopmentMode, 
	getPluginVersion, 
	readLocalLibraryIndex, 
	fetchRemoteLibraryIndex 
} from '../utils/library/library-access';

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

export const libraryListTool: ObsidianTool<LibraryListInput> = {
	specification: schema,
	icon: "library",
	sideEffects: false, // Read-only operation, safe for link expansion
	get initialLabel() {
		return t('tools.library.list.label');
	},
	execute: async (context: ToolExecutionContext<LibraryListInput>): Promise<void> => {
		try {
			context.setLabel(t('tools.library.list.inProgress'));

			let indexContent: string;
			let sourceInfo: string;

			// Check if we're in local development mode
			const isLocalDev = false; // await isLocalDevelopmentMode();

			if (isLocalDev) {
				console.debug("Reading from local library index...");
				indexContent = await readLocalLibraryIndex();
				sourceInfo = "\n\n**Source:** Local development library\n";
			} else {
				console.debug("Fetching from remote library index...");
				indexContent = await fetchRemoteLibraryIndex();
				const pluginVersion = await getPluginVersion();
				sourceInfo = `\n\n**Source:** GitHub repository (version ${pluginVersion})\n`;
			}

			// Add source information to the content
			const enhancedContent = indexContent + sourceInfo;

			context.progress(enhancedContent);
			context.setLabel(t('tools.library.list.completed'));

		} catch (error) {
			context.setLabel(t('tools.library.list.failed'));
			const errorMessage = error instanceof Error ? error.message : String(error);
			context.progress(`❌ Error: ${errorMessage}`);
			throw error instanceof ToolExecutionError ? error : new ToolExecutionError(errorMessage);
		}
	}
};