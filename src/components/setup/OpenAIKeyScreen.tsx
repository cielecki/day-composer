import React, { useState } from 'react';
import { t } from 'src/i18n';
import { getStore } from '../../store/plugin-store';
import { LucideIcon } from '../LucideIcon';

interface OpenAIKeyScreenProps {
	onKeyConfigured: () => void;
	onSkip: () => void;
}

export const OpenAIKeyScreen: React.FC<OpenAIKeyScreenProps> = ({
	onKeyConfigured,
	onSkip
}) => {
	const [apiKey, setApiKey] = useState('');
	const [isConfiguring, setIsConfiguring] = useState(false);
	const [isSkipping, setIsSkipping] = useState(false);

	const handleSaveKey = async () => {
		if (!apiKey.trim()) return;
		
		setIsConfiguring(true);
		try {
			await getStore().setSecret('OPENAI_API_KEY', apiKey.trim());
			getStore().setOpenaiKeyConfigured(true);
			await getStore().saveSettings();
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
			getStore().setOpenaiKeyConfigured(true);
			await getStore().saveSettings();
			onSkip();
		} catch (error) {
			console.error('Error saving skip state:', error);
			onSkip(); // Still skip even if save fails
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
				
				<div className="setup-key-link">
					<a 
						href="https://platform.openai.com/api-keys" 
						target="_blank" 
						rel="noopener noreferrer"
						className="setup-get-key-link"
					>
						<LucideIcon name="external-link" size={16} />
						{t('ui.setup.openaiKey.getKey')} →
					</a>
				</div>

				<div className="setup-input-focused">
					<input
						type="password"
						className="setup-input-large"
						placeholder={t('ui.setup.openaiKey.placeholder')}
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
			</div>
		</div>
	);
}; 