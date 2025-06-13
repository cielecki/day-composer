import { LNMode } from 'src/types/mode';
import { t } from 'src/i18n';
import { mergeWithDefaultMode } from './ln-mode-defaults';

/**
 * Get all pre-built modes that are always available in the system
 * These modes exist in code rather than as files and cannot be deleted
 */
export function getPrebuiltModes(): LNMode[] {
	const lifeNavigatorMode: Partial<LNMode> = {
		name: t('prebuiltModes.lifeNavigator.title'),
		path: ':prebuilt:guide',
		description: t('prebuiltModes.lifeNavigator.mainDescription'),
		system_prompt: t('prebuiltModes.lifeNavigator.systemPrompt'),
		voice_instructions: t('prebuiltModes.lifeNavigator.voiceInstructions'),
		icon: 'compass',
		icon_color: '#4ade80',
		example_usages: [
			'Start'
		],
		tools_allowed: ['*'],
		tools_disallowed: ['*task_*'],
		model: 'auto',
		expand_links: false,
		voice_autoplay: false,
	};

	// Merge with defaults to ensure all required fields are present
	const lifeNavigator = mergeWithDefaultMode(lifeNavigatorMode);

	return [lifeNavigator];
}

/**
 * Check if a mode is pre-built (cannot be deleted)
 */
export function isPrebuiltMode(modePath: string): boolean {
	return modePath.startsWith(':prebuilt:');
}