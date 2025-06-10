import React, { useState } from 'react';
import { t } from 'src/i18n';
import { getStore } from '../../store/plugin-store';
import { LucideIcon } from '../LucideIcon';

export const LanguageSelectionScreen: React.FC = () => {
	const [isConfiguring, setIsConfiguring] = useState(false);

	const supportedLanguages = [
		{ code: 'en', name: 'English', nativeName: 'English' },
		{ code: 'pl', name: 'Polish', nativeName: 'Polski' }
	];

	const handleLanguageChange = async (languageCode: string) => {
		setIsConfiguring(true);
		try {
			// Get current language from Obsidian
			const currentLanguage = window.localStorage.getItem('language');
			
			// Set Obsidian's language
			window.localStorage.setItem('language', languageCode);
			
			// Mark language as configured in plugin settings
			getStore().setObsidianLanguageConfigured(true);
			await getStore().saveSettings();

			if (languageCode !== currentLanguage) {
				if (window.app && (window.app as any).commands) {
					// @ts-ignore - Try to execute reload command
					(window.app as any).commands.executeCommandById('app:reload');
				} else {
					alert(t('ui.setup.language.manualRestart'));
				}
			}
		} catch (error) {
			console.error('Error configuring language:', error);
		} finally {
			setIsConfiguring(false);
		}
	};

	return (
		<div className="setup-screen-focused">
			<div className="setup-content-focused">
				<div className="setup-icon">
					<LucideIcon name="languages" size={64} color="var(--interactive-accent)" />
				</div>
				
				<h2 className="setup-title-focused">
					{t('ui.setup.language.title')}
				</h2>
				
				<p className="setup-description-focused">
					{t('ui.setup.language.description')}
				</p>
				
				<div className="setup-language-options">
					<h3>{t('ui.setup.language.supportedLanguages')}</h3>
					<div className="setup-language-buttons">
						{supportedLanguages.map((lang) => (
							<button
								key={lang.code}
								className="setup-language-button"
								onClick={() => handleLanguageChange(lang.code)}
								disabled={isConfiguring}
							>
								<div className="language-button-content">
									<span className="language-name">
										{lang.nativeName}
									</span>
								</div>
							</button>
						))}
					</div>
				</div>

				<div className="setup-language-note">
					<p>{t('ui.setup.language.note')}</p>
				</div>
			</div>
		</div>
	);
}; 