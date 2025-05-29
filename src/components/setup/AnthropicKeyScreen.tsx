import React, { useState } from 'react';
import { t } from '../../i18n';
import { getPluginSettings } from '../../settings/PluginSettings';
import { LucideIcon } from '../LucideIcon';

interface AnthropicKeyScreenProps {
	onKeyConfigured: () => void;
	onOpenSettings: () => void;
}

export const AnthropicKeyScreen: React.FC<AnthropicKeyScreenProps> = ({
	onKeyConfigured,
	onOpenSettings
}) => {
	const [apiKey, setApiKey] = useState('');
	const [isConfiguring, setIsConfiguring] = useState(false);

	const handleSaveKey = async () => {
		if (!apiKey.trim()) return;
		
		setIsConfiguring(true);
		try {
			const settings = getPluginSettings();
			settings.anthropicApiKey = apiKey.trim();
			await settings.saveSettings();
			onKeyConfigured();
		} catch (error) {
			console.error('Error saving Anthropic API key:', error);
		} finally {
			setIsConfiguring(false);
		}
	};

	const handleSkip = () => {
		onOpenSettings();
	};

	return (
		<div className="setup-screen">
			<div className="setup-content">
				<div className="setup-icon">
					<LucideIcon name="key" size={64} color="var(--interactive-accent)" />
				</div>
				
				<h2 className="setup-title">
					{t('ui.setup.anthropicKey.title')}
				</h2>
				
				<p className="setup-description">
					{t('ui.setup.anthropicKey.description')}
				</p>
				
				<div className="setup-steps">
					<div className="setup-step">
						<span className="setup-step-number">1</span>
						<div className="setup-step-content">
							<span>{t('ui.setup.anthropicKey.steps.visit')}</span>
							<a 
								href="https://console.anthropic.com/settings/keys" 
								target="_blank" 
								rel="noopener noreferrer"
								className="setup-step-link"
							>
								{t('ui.setup.anthropicKey.getKey')} →
							</a>
						</div>
					</div>
					<div className="setup-step">
						<span className="setup-step-number">2</span>
						<span>{t('ui.setup.anthropicKey.steps.create')}</span>
					</div>
					<div className="setup-step">
						<span className="setup-step-number">3</span>
						<span>{t('ui.setup.anthropicKey.steps.paste')}</span>
					</div>
				</div>

				<div className="setup-input-group">
					<div className="setup-input-label">
						{t('ui.setup.anthropicKey.inputLabel')}
					</div>
					<input
						type="password"
						className="setup-input"
						placeholder={t('ui.setup.anthropicKey.placeholder')}
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
						{isConfiguring ? t('ui.setup.saving') : t('ui.setup.anthropicKey.saveButton')}
					</button>
				</div>

				<div className="setup-help">
					<a 
						href="#" 
						onClick={(e) => {
							e.preventDefault();
							handleSkip();
						}}
						className="setup-link"
					>
						{t('ui.setup.openSettings')}
					</a>
				</div>
			</div>
		</div>
	);
}; 