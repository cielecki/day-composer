import React, { useState } from 'react';
import { t } from 'src/i18n';
import { getStore } from '../../store/plugin-store';
import { LucideIcon } from '../LucideIcon';


export const AnthropicKeyScreen: React.FC = () => {
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
				
				<div className="setup-steps-guide">
					<div className="setup-step">
						<div className="setup-step-number">1</div>
						<div className="setup-step-content">
							<h3 className="setup-step-title">{t('ui.setup.anthropicKey.steps.step1')}</h3>
							<a 
								href="https://console.anthropic.com/settings/keys" 
								target="_blank" 
								rel="noopener noreferrer"
								className="setup-action-button"
							>
								<LucideIcon name="external-link" size={16} />
								{t('ui.setup.anthropicKey.getKey')}
								<LucideIcon name="arrow-right" size={14} />
							</a>
							<p className="setup-step-description">{t('ui.setup.anthropicKey.steps.step1Description')}</p>
						</div>
					</div>

					<div className="setup-step">
						<div className="setup-step-number">2</div>
						<div className="setup-step-content">
							<h3 className="setup-step-title">{t('ui.setup.anthropicKey.steps.step2')}</h3>
							
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
							
							<button 
								className="setup-action-button"
								onClick={handleSaveKey}
								disabled={!apiKey.trim() || isConfiguring}
							>
								{isConfiguring ? t('ui.setup.saving') : t('ui.setup.anthropicKey.saveButton')}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}; 