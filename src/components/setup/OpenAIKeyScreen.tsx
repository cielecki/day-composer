import React, { useState } from 'react';
import { t } from 'src/i18n';
import { getStore } from '../../store/plugin-store';
import { LucideIcon } from '../LucideIcon';

export const OpenAIKeyScreen: React.FC = () => {
	const [apiKey, setApiKey] = useState('');
	const [isConfiguring, setIsConfiguring] = useState(false);
	const [isSkipping, setIsSkipping] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>('');

	const handleSaveKey = async () => {
		if (!apiKey.trim()) return;
		
		setIsConfiguring(true);
		setErrorMessage('');
		
		try {
			// Validate the key first
			const result = await getStore().validateOpenAIKey(apiKey.trim());
			
			if (result.valid) {
				// If valid, save and continue
				await getStore().setSecret('OPENAI_API_KEY', apiKey.trim());
				await getStore().saveSettings();
			} else {
				// If invalid, show error
				setErrorMessage(result.reason || t('ui.setup.validation.invalid'));
			}
		} catch (error) {
			console.error('Error validating OpenAI API key:', error);
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

	const handleSkip = async () => {
		console.debug('Skip button clicked');
		setIsSkipping(true);
		
		try {
			// Set the skipped flag instead of configured flag
			getStore().updateSettings({
				tutorial: {
					...getStore().settings.tutorial,
					openaiKeySkipped: true
				}
			});
			await getStore().saveSettings();
		} catch (error) {
			console.error('Error saving skip state:', error);
		} finally {
			setIsSkipping(false);
		}
	};

	return (
		<div className="setup-screen-focused">
			<div className="setup-content-focused">
				<div className="setup-icon">
					<LucideIcon name="mic" size={48} color="var(--interactive-accent)" />
				</div>
				
				<h2 className="setup-title-focused">
					{t('ui.setup.openaiKey.title')}
				</h2>
				
				<p className="setup-description-focused">
					{t('ui.setup.openaiKey.description')}
				</p>
				
				<div className="setup-steps-guide">
					<div className="setup-step">
						<div className="setup-step-number">1</div>
						<div className="setup-step-content">
							<h3 className="setup-step-title">{t('ui.setup.openaiKey.steps.step1')}</h3>
							<a 
								href="https://platform.openai.com/api-keys" 
								target="_blank" 
								rel="noopener noreferrer"
								className="setup-action-button"
							>
								<LucideIcon name="external-link" size={16} />
								{t('ui.setup.openaiKey.getKey')}
								<LucideIcon name="arrow-right" size={14} />
							</a>
							<p className="setup-step-description">{t('ui.setup.openaiKey.steps.step1Description')}</p>
						</div>
					</div>

					<div className="setup-step">
						<div className="setup-step-number">2</div>
						<div className="setup-step-content">
							<h3 className="setup-step-title">{t('ui.setup.openaiKey.steps.step2')}</h3>
							
							<input
								type="password"
								className={`setup-input-large ${errorMessage ? 'validation-error' : ''}`}
								placeholder={t('ui.setup.openaiKey.placeholder')}
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
								{isConfiguring ? t('ui.setup.saving') : t('ui.setup.openaiKey.saveButton')}
							</button>
							<button 
								className="setup-action-button-secondary"
								onClick={handleSkip}
								disabled={isSkipping}
							>
								{isSkipping ? t('ui.setup.saving') : t('ui.setup.openaiKey.skipButton')}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}; 