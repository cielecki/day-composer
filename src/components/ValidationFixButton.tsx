import React from 'react';
import { usePluginStore } from '../store/plugin-store';
import { t } from '../i18n';
import { LucideIcon } from './LucideIcon';

interface ValidationFixButtonProps {
	type: 'modes' | 'tools' | 'specific-mode';
	modeId?: string; // For specific mode fixes
	className?: string;
	showIcon?: boolean;
	displayMode?: 'button-only' | 'text-and-button' | 'dropdown-item'; // New prop for display mode
}

// Helper function to determine the correct plural form for Polish
const getPluralForm = (count: number): 'singular' | 'few' | 'many' => {
	if (count === 1) return 'singular';
	if (count >= 2 && count <= 4) return 'few';
	return 'many';
};

// Helper function to determine the correct plural form for English (just singular/plural)
const getEnglishPluralForm = (count: number): 'singular' | 'plural' => {
	return count === 1 ? 'singular' : 'plural';
};

export const ValidationFixButton: React.FC<ValidationFixButtonProps> = ({ 
	type, 
	modeId, 
	className = '', 
	showIcon = true,
	displayMode = 'text-and-button'
}) => {
	const store = usePluginStore();
	const invalidModes = store.validation.invalidModes;
	const invalidTools = store.validation.invalidTools;
	
	// Don't show if no validation issues
	if (type === 'modes' && invalidModes.length === 0) return null;
	if (type === 'tools' && invalidTools.length === 0) return null;
	if (type === 'specific-mode' && modeId && !invalidModes.includes(modeId)) return null;
	
	const handleClick = () => {
		// Switch to guide mode
		store.setActiveModeWithPersistence(':prebuilt:guide');
		
		// Create appropriate message based on type
		let message = '';
		switch (type) {
			case 'modes':
				const modesPlural = getPluralForm(invalidModes.length);
				const modesEnglishPlural = getEnglishPluralForm(invalidModes.length);
				// Format file paths nicely - show first 5 and indicate if there are more
				const modePathsFormatted = invalidModes.length <= 5 
					? invalidModes.join(', ')
					: `${invalidModes.slice(0, 5).join(', ')} and ${invalidModes.length - 5} more`;
				message = t(`validation.fixModes.message.${modesPlural}`, {
					filePaths: modePathsFormatted,
					defaultValue: t(`validation.fixModes.message.${modesEnglishPlural}`, {
						filePaths: modePathsFormatted,
						defaultValue: `Help me fix validation issues with my modes. I have the following mode files with validation errors: ${modePathsFormatted}`
					})
				});
				break;
			case 'tools':
				const toolsPlural = getPluralForm(invalidTools.length);
				const toolsEnglishPlural = getEnglishPluralForm(invalidTools.length);
				// Format file paths nicely - show first 5 and indicate if there are more
				const toolPathsFormatted = invalidTools.length <= 5 
					? invalidTools.join(', ')
					: `${invalidTools.slice(0, 5).join(', ')} and ${invalidTools.length - 5} more`;
				message = t(`validation.fixTools.message.${toolsPlural}`, {
					filePaths: toolPathsFormatted,
					defaultValue: t(`validation.fixTools.message.${toolsEnglishPlural}`, {
						filePaths: toolPathsFormatted,
						defaultValue: `Help me fix validation issues with my tools. I have the following tool files with validation errors: ${toolPathsFormatted}`
					})
				});
				break;
			case 'specific-mode':
				const filePath = modeId || 'this mode';
				message = t('validation.fixSpecificMode.message', {
					filePath,
					defaultValue: `Help me fix validation issues with the mode file "${filePath}". This mode file has validation errors that need to be resolved.`
				});
				break;
		}
		
		// Send the message
		store.addUserMessage(message);
	};
	
	// Get button text based on type
	const getButtonText = () => {
		switch (type) {
			case 'modes':
				const modesPlural = getPluralForm(invalidModes.length);
				const modesEnglishPlural = getEnglishPluralForm(invalidModes.length);
				return t(`validation.fixModes.button.${modesPlural}`, { 
					count: invalidModes.length,
					defaultValue: t(`validation.fixModes.button.${modesEnglishPlural}`, { 
						count: invalidModes.length,
						defaultValue: `Fix Mode Issues (${invalidModes.length})` 
					})
				});
			case 'tools':
				const toolsPlural = getPluralForm(invalidTools.length);
				const toolsEnglishPlural = getEnglishPluralForm(invalidTools.length);
				return t(`validation.fixTools.button.${toolsPlural}`, { 
					count: invalidTools.length,
					defaultValue: t(`validation.fixTools.button.${toolsEnglishPlural}`, { 
						count: invalidTools.length,
						defaultValue: `Fix Tool Issues (${invalidTools.length})` 
					})
				});
			case 'specific-mode':
				return t('validation.fixSpecificMode.button', { 
					defaultValue: 'Fix This Mode' 
				});
		}
	};
	
	// Get description text
	const getDescriptionText = () => {
		switch (type) {
			case 'modes':
				const modesPlural = getPluralForm(invalidModes.length);
				const modesEnglishPlural = getEnglishPluralForm(invalidModes.length);
				return t(`validation.fixModes.description.${modesPlural}`, { 
					count: invalidModes.length,
					defaultValue: t(`validation.fixModes.description.${modesEnglishPlural}`, { 
						count: invalidModes.length,
						defaultValue: `${invalidModes.length} mode file${invalidModes.length > 1 ? 's' : ''} have validation issues that need to be resolved.` 
					})
				});
			case 'tools':
				const toolsPlural = getPluralForm(invalidTools.length);
				const toolsEnglishPlural = getEnglishPluralForm(invalidTools.length);
				return t(`validation.fixTools.description.${toolsPlural}`, { 
					count: invalidTools.length,
					defaultValue: t(`validation.fixTools.description.${toolsEnglishPlural}`, { 
						count: invalidTools.length,
						defaultValue: `${invalidTools.length} tool file${invalidTools.length > 1 ? 's' : ''} have validation issues that need to be resolved.` 
					})
				});
			case 'specific-mode':
				const modeName = modeId ? modeId.split('/').pop()?.replace('.md', '') || modeId : 'This mode';
				return t('validation.fixSpecificMode.description', {
					modeName,
					defaultValue: `The current mode "${modeName}" has validation issues that need to be resolved.`
				});
		}
	};
	
	if (displayMode === 'button-only') {
		return (
			<button
				onClick={handleClick}
				className={`validation-fix-button ${className}`}
				title={t('validation.fixButton.tooltip', { 
					defaultValue: 'Switch to Guide mode and get help fixing validation issues' 
				})}
			>
				{showIcon && '🔧 '}
				{getButtonText()}
			</button>
		);
	}
	
	if (displayMode === 'dropdown-item') {
		return (
			<div
				onClick={handleClick}
				className={`ln-mode-action-item ${className}`}
				title={t('validation.fixButton.tooltip', { 
					defaultValue: 'Switch to Guide mode and get help fixing validation issues' 
				})}
			>
				{showIcon && (
					<LucideIcon name="wrench" size={16} color="var(--text-normal)" />
				)}
				{getButtonText()}
			</div>
		);
	}
	
	// Default: text-and-button mode
	return (
		<div className={`validation-fix-section ${className}`}>
			{getDescriptionText() && (
				<div className="validation-description">
					⚠️ {getDescriptionText()}
				</div>
			)}
			<button
				onClick={handleClick}
				className="validation-fix-button"
				title={t('validation.fixButton.tooltip', { 
					defaultValue: 'Switch to Guide mode and get help fixing validation issues' 
				})}
			>
				🔧 {getButtonText()}
			</button>
		</div>
	);
}; 