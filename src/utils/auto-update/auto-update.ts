import { App,  Notice, Plugin } from 'obsidian';
import { t } from 'src/i18n';

// Compare versions helper
function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const na = pa[i] || 0, nb = pb[i] || 0;
		if (na > nb) return 1;
		if (na < nb) return -1;
	}
	return 0;
}

// Shared function to check for available updates
export const checkForAvailableUpdate = async (app: App): Promise<{
	currentVersion: string;
	latestVersion: string;
	hasUpdate: boolean;
	releaseInfo?: any;
} | null> => {
	try {
		const repo = "cielecki/life-navigator";
		const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

		// Read current version from manifest.json
		const manifestPath = app.vault.configDir + "/plugins/life-navigator/manifest.json";
		// @ts-ignore
		const manifestContent = await app.vault.adapter.read(manifestPath);
		const manifest = JSON.parse(manifestContent);
		const currentVersion = manifest.version;

		// Get latest release info
		const response = await fetch(apiUrl, {
			headers: {
				'Accept': 'application/vnd.github+json',
				'User-Agent': 'Life-Navigator-Plugin'
			}
		});

		if (!response.ok) {
			return null;
		}

		const release = await response.json();
		const latestVersion = release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name;

		const cmp = compareVersions(latestVersion, currentVersion);
		const hasUpdate = cmp > 0;

		return {
			currentVersion,
			latestVersion,
			hasUpdate,
			releaseInfo: release
		};
	} catch (error) {
		console.log('Version check failed:', error);
		return null;
	}
};

// Check for updates on startup if enabled and not checked recently
export const checkForUpdatesOnStartup = async (plugin: Plugin) => {
	try {
		const updateInfo = await checkForAvailableUpdate(plugin.app);
		if (updateInfo && updateInfo.hasUpdate) {
			new Notice(t("messages.updateAvailable", { 
				latestVersion: updateInfo.latestVersion, 
				currentVersion: updateInfo.currentVersion 
			}), 10000);
		}
	} catch (error) {
		console.log('Startup update check failed silently:', error);
		// Fail silently to avoid interrupting user experience
	}
};


