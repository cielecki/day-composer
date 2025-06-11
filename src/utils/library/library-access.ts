import { LifeNavigatorPlugin } from "../../LifeNavigatorPlugin";
import { ToolExecutionError } from '../../types/tool-execution-error';
import { requestUrl } from "obsidian";

// Life Navigator repository configuration
const LIFE_NAVIGATOR_REPO = 'cielecki/life-navigator';
const LIBRARY_PATH = 'library';

/**
 * Check if we're in local development mode by looking for library folder in plugin directory
 */
export async function isLocalDevelopmentMode(): Promise<boolean> {
	try {
		const plugin = LifeNavigatorPlugin.getInstance();
		const pluginDir = plugin.app.vault.configDir + "/plugins/life-navigator";
		const libraryPath = pluginDir + "/library";
		
		// Check if library directory exists locally
		const libraryExists = await plugin.app.vault.adapter.exists(libraryPath);
		return libraryExists;
	} catch (error) {
		console.debug('Error checking for local development mode:', error);
		return false;
	}
}

/**
 * Get current plugin version from manifest
 */
export async function getPluginVersion(): Promise<string> {
	try {
		const plugin = LifeNavigatorPlugin.getInstance();
		const manifestPath = plugin.app.vault.configDir + "/plugins/life-navigator/manifest.json";
		// @ts-ignore
		const manifestContent = await plugin.app.vault.adapter.read(manifestPath);
		const manifest = JSON.parse(manifestContent);
		return manifest.version;
	} catch (error) {
		console.debug('Error reading plugin version:', error);
		return '0.11.2'; // Fallback to current version
	}
}

/**
 * Read content from local library folder
 */
export async function readLocalLibraryContent(path: string): Promise<string> {
	const plugin = LifeNavigatorPlugin.getInstance();
	const pluginDir = plugin.app.vault.configDir + "/plugins/life-navigator";
	const fullPath = `${pluginDir}/library/${path}`;
	
	try {
		const content = await plugin.app.vault.adapter.read(fullPath);
		return content;
	} catch (error) {
		throw new ToolExecutionError(`Failed to read local library file: ${path}. File may not exist locally.`);
	}
}

/**
 * Read index from local library folder
 */
export async function readLocalLibraryIndex(): Promise<string> {
	return readLocalLibraryContent('index.md');
}

/**
 * Fetch content from remote GitHub using version tag with fallback to main
 */
export async function fetchRemoteLibraryContent(path: string): Promise<string> {
	const [owner, repo] = LIFE_NAVIGATOR_REPO.split('/');
	const pluginVersion = await getPluginVersion();
	
	// Try version tag first
	const versionUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${pluginVersion}/${LIBRARY_PATH}/${path}`;
	
	console.debug(`Fetching ${versionUrl}`);
	try {
		const response = await requestUrl({
			url: versionUrl,
			method: 'GET',
			headers: {
				'User-Agent': 'Life Navigator Obsidian Plugin'
			}
		});

		if (response.status === 200) {
			return response.text;
		}
	} catch (error) {
		console.debug(`Failed to fetch from version tag ${pluginVersion}, trying main branch:`, error);
	}

	// Fallback to main branch
	const mainUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${LIBRARY_PATH}/${path}`;
	
	const response = await requestUrl({
		url: mainUrl,
		method: 'GET',
		headers: {
			'User-Agent': 'Life Navigator Obsidian Plugin'
		}
	});

	if (response.status !== 200) {
		throw new ToolExecutionError(`Failed to download ${path}. Status: ${response.status} (file may not exist)`);
	}

	return response.text;
}

/**
 * Fetch index from remote GitHub using version tag with fallback to main
 */
export async function fetchRemoteLibraryIndex(): Promise<string> {
	const [owner, repo] = LIFE_NAVIGATOR_REPO.split('/');
	const pluginVersion = await getPluginVersion();
	
	// Try version tag first
	const versionUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${pluginVersion}/library/index.md`;
	
	console.debug(`Fetching ${versionUrl}`);
	try {
		const response = await fetch(versionUrl);
		if (response.ok) {
			return await response.text();
		}
	} catch (error) {
		console.debug(`Failed to fetch from version tag ${pluginVersion}, trying main branch:`, error);
	}

	// Fallback to main branch
	const mainUrl = `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/library/index.md`;
	const response = await fetch(mainUrl);

	if (!response.ok) {
		throw new ToolExecutionError(`Failed to access library index (HTTP ${response.status})`);
	}

	return await response.text();
} 