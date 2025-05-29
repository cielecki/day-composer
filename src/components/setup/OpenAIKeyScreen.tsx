import React, { useState } from 'react';
import { t } from '../../i18n';
import { getPluginSettings } from '../../settings/PluginSettings';
import { LucideIcon } from '../LucideIcon';

interface OpenAIKeyScreenProps {
	onKeyConfigured: () => void;
	onOpenSettings: () => void;
	onSkip: () => void;
}

export const OpenAIKeyScreen: React.FC<OpenAIKeyScreenProps> = ({
	onKeyConfigured,
	onOpenSettings,
	onSkip
}) => {
	const [apiKey, setApiKey] = useState('');
	const [isConfiguring, setIsConfiguring] = useState(false);
	const [isSkipping, setIsSkipping] = useState(false);

	const handleSaveKey = async () => {
		if (!apiKey.trim()) return;
		
		setIsConfiguring(true);
		try {
			const settings = getPluginSettings();
			settings.openAIApiKey = apiKey.trim();
			settings.tutorial.openaiKeyConfigured = true;
			await settings.saveSettings();
			onKeyConfigured();
		} catch (error) {
			console.error('Error saving OpenAI API key:', error);
		} finally {
			setIsConfiguring(false);
		}
	};

	const handleSkip = async () => {
		console.log('Skip button clicked');
		setIsSkipping(true);
		
		try {
			const settings = getPluginSettings();
			console.log('Setting openaiKeyConfigured to true');
			settings.tutorial.openaiKeyConfigured = true;
			await settings.saveSettings();
			console.log('Settings saved, calling onSkip');
			onSkip();
		} catch (error) {
			console.error('Error saving skip state:', error);
			onSkip(); // Still skip even if save fails
		} finally {
			setIsSkipping(false);
		}
	};

	const handleOpenSettings = () => {
		onOpenSettings();
	};

	return (
		<div className="setup-screen">
			<div className="setup-content">
				<div className="setup-icon">
					<LucideIcon name="mic" size={64} color="var(--interactive-accent)" />
				</div>
				
				<h2 className="setup-title">
					{t('ui.setup.openaiKey.title')}
				</h2>
				
				<p className="setup-description">
					{t('ui.setup.openaiKey.description')}
				</p>
				
				<div className="setup-steps">
					<div className="setup-step">
						<span className="setup-step-number">1</span>
						<div className="setup-step-content">
							<span>{t('ui.setup.openaiKey.steps.visit')}</span>
							<a 
								href="https://platform.openai.com/api-keys" 
								target="_blank" 
								rel="noopener noreferrer"
								className="setup-step-link"
							>
								{t('ui.setup.openaiKey.getKey')} →
							</a>
						</div>
					</div>
					<div className="setup-step">
						<span className="setup-step-number">2</span>
						<span>{t('ui.setup.openaiKey.steps.create')}</span>
					</div>
					<div className="setup-step">
						<span className="setup-step-number">3</span>
						<span>{t('ui.setup.openaiKey.steps.paste')}</span>
					</div>
				</div>

				<div className="setup-input-group">
					<div className="setup-input-label">
						{t('ui.setup.openaiKey.inputLabel')}
					</div>
					<input
						type="password"
						className="setup-input"
						placeholder={t('ui.setup.openaiKey.placeholder')}
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && apiKey.trim()) {
								handleSaveKey();
							}
						}}
					/>
				</div>

				<div className="setup-buttons">
					<button 
						className="mod-cta setup-button"
						onClick={handleSaveKey}
						disabled={!apiKey.trim() || isConfiguring}
					>
						{isConfiguring ? t('ui.setup.saving') : t('ui.setup.openaiKey.saveButton')}
					</button>
					<button 
						className="setup-button-secondary"
						onClick={handleSkip}
						disabled={isSkipping}
					>
						{isSkipping ? t('ui.setup.saving') : t('ui.setup.openaiKey.skipButton')}
					</button>
				</div>

				<div className="setup-help">
					<a 
						href="#" 
						onClick={(e) => {
							e.preventDefault();
							handleOpenSettings();
						}}
						className="setup-link"
					>
						{t('ui.setup.openSettings')}
					</a>
				</div>

				<div className="setup-note">
					<p>{t('ui.setup.openaiKey.note')}</p>
				</div>
			</div>
		</div>
	);
}; 