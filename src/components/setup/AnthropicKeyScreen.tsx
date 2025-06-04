import React, { useState } from 'react';
import { t } from 'src/i18n';
import { getStore } from '../../store/plugin-store';
import { LucideIcon } from '../LucideIcon';

interface AnthropicKeyScreenProps {
	onKeyConfigured: () => void;
}

export const AnthropicKeyScreen: React.FC<AnthropicKeyScreenProps> = ({
	onKeyConfigured
}) => {
	const [apiKey, setApiKey] = useState('');
	const [isConfiguring, setIsConfiguring] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>('');

	const handleSaveKey = async () => {
		if (!apiKey.trim()) return;
		
		setIsConfiguring(true);
		setErrorMessage('');
		
		try {
			// Validate the key first
			const result = await getStore().validateAnthropicKey(apiKey.trim());
			
			if (result.valid) {
				// If valid, save and continue
				await getStore().setSecret('ANTHROPIC_API_KEY', apiKey.trim());
				onKeyConfigured();
			} else {
				// If invalid, show error
				setErrorMessage(result.reason || t('ui.setup.validation.invalid'));
			}
		} catch (error) {
			console.error('Error validating Anthropic API key:', error);
			setErrorMessage(t('ui.setup.validation.reasons.networkError'));
		} finally {
			setIsConfiguring(false);
		}
	};

	const handleKeyChange = (value: string) => {
		setApiKey(value);
		// Reset error when key changes
		if (errorMessage) {
			setErrorMessage('');
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
						className={`setup-input-large ${errorMessage ? 'validation-error' : ''}`}
						placeholder={t('ui.setup.anthropicKey.placeholder')}
						value={apiKey}
						onChange={(e) => handleKeyChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && apiKey.trim()) {
								handleSaveKey();
							}
						}}
						autoFocus
					/>
					{errorMessage && (
						<div className="validation-message error">
							<LucideIcon 
								name="x-circle" 
								size={16} 
							/>
							<span>{errorMessage}</span>
						</div>
					)}
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