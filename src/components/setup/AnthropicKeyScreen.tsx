import React, { useState } from 'react';
import { t } from '../../i18n';
import { getPluginSettings } from '../../settings/LifeNavigatorSettings';
import { LucideIcon } from '../LucideIcon';

interface AnthropicKeyScreenProps {
	onKeyConfigured: () => void;
}

export const AnthropicKeyScreen: React.FC<AnthropicKeyScreenProps> = ({
	onKeyConfigured
}) => {
	const [apiKey, setApiKey] = useState('');
	const [isConfiguring, setIsConfiguring] = useState(false);

	const handleSaveKey = async () => {
		if (!apiKey.trim()) return;
		
		setIsConfiguring(true);
		try {
			const settings = getPluginSettings();
			settings.setSecret('ANTHROPIC_API_KEY', apiKey.trim());
			await settings.saveSettings();
			onKeyConfigured();
		} catch (error) {
			console.error('Error saving Anthropic API key:', error);
		} finally {
			setIsConfiguring(false);
		}
	};

	return (
		<div className="setup-screen-focused">
			<div className="setup-content-focused">
				<div className="setup-icon">
					<LucideIcon name="key" size={48} color="var(--interactive-accent)" />
				</div>
				
				<h2 className="setup-title-focused">
					{t('ui.setup.anthropicKey.title')}
				</h2>
				
				<p className="setup-description-focused">
					{t('ui.setup.anthropicKey.description')}
				</p>
				
				<div className="setup-key-link">
					<a 
						href="https://console.anthropic.com/settings/keys" 
						target="_blank" 
						rel="noopener noreferrer"
						className="setup-get-key-link"
					>
						<LucideIcon name="external-link" size={16} />
						{t('ui.setup.anthropicKey.getKey')} →
					</a>
				</div>

				<div className="setup-input-focused">
					<input
						type="password"
						className="setup-input-large"
						placeholder={t('ui.setup.anthropicKey.placeholder')}
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && apiKey.trim()) {
								handleSaveKey();
							}
						}}
						autoFocus
					/>
				</div>

				<div className="setup-actions-focused">
					<button 
						className="setup-button-primary"
						onClick={handleSaveKey}
						disabled={!apiKey.trim() || isConfiguring}
					>
						{isConfiguring ? t('ui.setup.saving') : t('ui.setup.anthropicKey.saveButton')}
					</button>
				</div>
			</div>
		</div>
	);
}; 