import { App, Notice } from 'obsidian';
import path from 'path';
import { createNestedDirectory } from './utils/fs/create-nested-directory';
import { STARTER_KIT_DATA } from './generated/starter-kit-data';
import { t } from './i18n';
import { generateUniqueDirectoryName } from './utils/tools/generate-unique-directory-name';

// Starter Kit Version - increment when making changes to starter kit content or structure
const STARTER_KIT_VERSION = "0.11";

export const createStarterKit = async (app: App) => {
	try {
		const currentLanguage = window.localStorage.getItem('language') || 'en';
		const fallbackLanguage = 'en';

		let baseStarterKitDirName = t('ui.starterKit.directoryName');

		baseStarterKitDirName = `${baseStarterKitDirName} v${STARTER_KIT_VERSION}`;

		// Generate a unique directory name
		const starterKitDirName = await generateUniqueDirectoryName(app, baseStarterKitDirName);

		// Check if we have files for the current language
		if (!STARTER_KIT_DATA[currentLanguage]) {
			console.warn(`No starter kit files defined for language: ${currentLanguage}. Falling back to ${fallbackLanguage}.`);

			// If fallback language also doesn't exist, show error and exit
			if (!STARTER_KIT_DATA[fallbackLanguage]) {
				new Notice(`Error: No starter kit files defined for current language (${currentLanguage}) or fallback (${fallbackLanguage}).`);
				console.error(`Starter Kit: No files for language ${currentLanguage} or fallback ${fallbackLanguage}.`);
				return;
			}
		}

		// Use current language files if available, otherwise fallback
		const starterFiles = STARTER_KIT_DATA[currentLanguage] || STARTER_KIT_DATA[fallbackLanguage];

		for (const item of starterFiles) {
			// Get file details directly
			const { subPath, filename, content } = item;

			if (!filename) {
				new Notice(`Skipping file: missing filename.`);
				console.error(`Starter Kit: Critical - Missing filename for a file. Skipping.`);
				continue;
			}

			if (!content) {
				new Notice(`Skipping file '${filename}': missing content.`);
				console.error(`Starter Kit: Critical - Missing content for file ${filename}. Skipping.`);
				continue;
			}

			const filePath = path.join(starterKitDirName, subPath, filename);
			const directory = path.dirname(filePath);

			// Use the improved nested directory creation function
			await createNestedDirectory(app, directory);

			// Check if file already exists
			if (app.vault.getAbstractFileByPath(filePath)) {
				new Notice(`File ${filePath} already exists, skipping.`);
				continue; // Skip if file already exists
			}

			await app.vault.create(filePath, content);
		}

		new Notice(t('ui.starterKit.createdSuccess'));
	} catch (error) {
		new Notice(t('ui.starterKit.createdError', { error: String(error) }));
		console.error("Error creating a Starter Kit:", error);
	}
};
