import { App, Notice } from 'obsidian';
import { t } from '../../i18n';
import { getDefaultLNMode, DEFAULT_VOICE_INSTRUCTIONS, mergeWithDefaultMode } from './ln-mode-defaults';
import { LNMode } from './LNMode';
import { modeToNoteContent } from './mode-to-note-content';
import { sanitizeString } from '../text/string-sanitizer';

// Create a new function to create a single mode


export const createNewMode = async (app: App) => {
	// List of available Lucide icons used in the plugin
	const AVAILABLE_ICONS = [
		"sparkles",
		"calendar-with-checkmark",
		"search",
		"lucide-sun-moon",
		"magnifying-glass",
		"target",
		"lucide-history",
		"lucide-calendar-plus",
		"lucide-file-search",
		"brain",
		"lock",
		"settings",
		"terminal",
		"plus",
		"list-checks",
		"square",
		"check-square",
		"x-square",
		"arrow-right-square",
		"info"
	];

	// List of available colors used in the plugin
	const AVAILABLE_COLORS = [
		"#4caf50", // green
		"#2196f3", // blue
		"#ff9800", // orange
		"#ff5722", // deep orange
		"#9c27b0", // purple
		"#673ab7", // deep purple
		"#3f51b5", // indigo
		"#00bcd4", // cyan
		"#e91e63", // pink
		"#f44336", // red
		"#8bc34a", // light green
		"#cddc39", // lime
		"#ffc107", // amber
		"#795548", // brown
		"#607d8b" // blue grey
	];

	try {
		// Randomly select an icon and color
		const randomIcon = AVAILABLE_ICONS[Math.floor(Math.random() * AVAILABLE_ICONS.length)];
		const randomColor = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];

		// Create a new mode with default values
		const defaultMode = getDefaultLNMode();
		const newMode: Partial<LNMode> = {
			ln_name: t('ui.mode.newMode'),
			ln_description: t('ui.mode.defaultDescription'),
			ln_icon: randomIcon,
			ln_icon_color: randomColor,
			ln_system_prompt: defaultMode.ln_system_prompt,
			ln_example_usages: [],
			ln_voice_autoplay: true,
			ln_voice: "alloy",
			ln_voice_instructions: DEFAULT_VOICE_INSTRUCTIONS,
			ln_voice_speed: 1.0,
		};

		// Ensure ln_name is defined
		const baseModeName = newMode.ln_name || t('ui.mode.newMode');
		const sanitizedBaseName = sanitizeString(baseModeName, { allowSpaces: true, lowercase: false });

		// Find a unique filename by incrementing a number if needed
		let counter = 1;
		let fileName = `${sanitizedBaseName}.md`;
		let filePath = fileName;

		while (app.vault.getAbstractFileByPath(filePath)) {
			fileName = `${sanitizedBaseName} ${counter}.md`;
			filePath = fileName;
			counter++;
		}

		// Create a complete mode object by merging with defaults
		const completeMode: LNMode = {
			...mergeWithDefaultMode(newMode),
			ln_path: filePath,
			ln_name: fileName.replace(".md", ""), // Update the name to match the file name
		};

		// Convert mode to note content using the utility function
		const fileContent = modeToNoteContent(completeMode);

		// Create the file
		const newFile = await app.vault.create(filePath, fileContent);

		// Show a single notification
		new Notice(t('ui.mode.createdSuccess'));

		// Open the file in a new leaf
		if (newFile) {
			const leaf = app.workspace.getLeaf();
			await leaf.openFile(newFile);
		}
	} catch (error) {
		// Only show error notification if there's a problem
		new Notice(t('ui.mode.createdError', { error: String(error) }));
		console.error("Error creating a new mode:", error);
	}
};
