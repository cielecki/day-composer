import React, { useState, useEffect } from 'react';
import { t } from '../../i18n';
import { getPluginSettings } from '../../settings/PluginSettings';
import { LucideIcon } from '../LucideIcon';

interface LanguageSelectionScreenProps {
	onLanguageConfigured: () => void;
}

export const LanguageSelectionScreen: React.FC<LanguageSelectionScreenProps> = ({
	onLanguageConfigured
}) => {
	const [currentLanguage, setCurrentLanguage] = useState<string>('');
	const [isConfiguring, setIsConfiguring] = useState(false);

	// Get current Obsidian language setting
	useEffect(() => {
		const obsidianLang = window.localStorage.getItem('language') || 'en';
		setCurrentLanguage(obsidianLang);
	}, []);

	const supportedLanguages = [
		{ code: 'en', name: 'English', nativeName: 'English' },
		{ code: 'pl', name: 'Polish', nativeName: 'Polski' }
	];

	const handleLanguageChange = async (languageCode: string) => {
		setIsConfiguring(true);
		try {
			// Set Obsidian's language
			window.localStorage.setItem('language', languageCode);
			
			// Mark language as configured in plugin settings
			const settings = getPluginSettings();
			settings.tutorial.obsidianLanguageConfigured = true;
			await settings.saveSettings();

			if (languageCode !== currentLanguage) {
				if (window.app && (window.app as any).commands) {
					// @ts-ignore - Try to execute reload command
					(window.app as any).commands.executeCommandById('app:reload');
				} else {
					alert(t('ui.setup.language.manualRestart'));
				}
			}
			
			onLanguageConfigured();
		} catch (error) {
			console.error('Error configuring language:', error);
		} finally {
			setIsConfiguring(false);
		}
	};

	const isCurrentLanguageSupported = () => {
		return supportedLanguages.some(lang => lang.code === currentLanguage);
	};

	const getCurrentLanguageName = () => {
		const lang = supportedLanguages.find(l => l.code === currentLanguage);
		return lang ? lang.nativeName : currentLanguage;
	};

	// Create available language options including current unsupported language
	const getAvailableLanguages = () => {
		const languages = [...supportedLanguages];
		
		// Add current language if it's not supported
		if (!isCurrentLanguageSupported() && currentLanguage) {
			languages.push({
				code: currentLanguage,
				name: currentLanguage,
				nativeName: `${currentLanguage}`
			});
		}
		
		return languages;
	};

	return (
		<div className="setup-screen">
			<div className="setup-content">
				<div className="setup-icon">
					<LucideIcon name="languages" size={64} color="var(--interactive-accent)" />
				</div>
				
				<h2 className="setup-title">
					{t('ui.setup.language.title')}
				</h2>
				
				<p className="setup-description">
					{t('ui.setup.language.description')}
				</p>

				{!isCurrentLanguageSupported() && (
					<div className="setup-language-info">
						<div className="setup-current-language">
							<strong>{t('ui.setup.language.currentLanguage')}</strong> {getCurrentLanguageName()}
						</div>
					</div>
				)}
				
				<div className="setup-language-options">
					<h3>{t('ui.setup.language.supportedLanguages')}</h3>
					<div className="setup-language-buttons">
						{getAvailableLanguages().map((lang) => (
							<button
								key={lang.code}
								className={`setup-language-button`}
								onClick={() => handleLanguageChange(lang.code)}
								disabled={isConfiguring}
							>
								<span className="language-name">
									{lang.nativeName}
									{currentLanguage === lang.code && (
										<span className="language-current"> ✓ {t('ui.setup.language.current')}</span>
									)}
								</span>
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