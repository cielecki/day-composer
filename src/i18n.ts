import i18next, { TOptions } from 'i18next';
import en from './locales/en.json';
import pl from './locales/pl.json';
import { lifeNavigatorSystemPrompt as enLifeNavigatorSystemPrompt, lifeNavigatorMainDescription as enLifeNavigatorMainDescription } from './locales/prompts/lifeNavigator.en';
import { lifeNavigatorSystemPrompt as plLifeNavigatorSystemPrompt, lifeNavigatorMainDescription as plLifeNavigatorMainDescription } from './locales/prompts/lifeNavigator.pl';
import { App } from 'obsidian';

export const initI18n = async (app: App) => {
  // Get Obsidian's language setting from localStorage
  const obsidianLang = window.localStorage.getItem('language') || 'en';
  console.debug('Obsidian language setting from localStorage:', obsidianLang);
  
  // Map Obsidian's language codes to our supported languages
  const langMap: Record<string, string> = {
    'en': 'en',
    'pl': 'pl',
    'en-US': 'en',
    'pl-PL': 'pl',
    // Add more mappings as needed
  };
  const initialLang = langMap[obsidianLang] || 'en';
  console.debug('Mapped to plugin language:', initialLang);

  // Merge translations with long texts from dedicated files
  const enTranslations = {
    ...en,
    prebuiltModes: {
      ...en.prebuiltModes,
      lifeNavigator: {
        ...en.prebuiltModes.lifeNavigator,
        systemPrompt: enLifeNavigatorSystemPrompt,
        mainDescription: enLifeNavigatorMainDescription
      }
    }
  };

  const plTranslations = {
    ...pl,
    prebuiltModes: {
      ...pl.prebuiltModes,
      lifeNavigator: {
        ...pl.prebuiltModes.lifeNavigator,
        systemPrompt: plLifeNavigatorSystemPrompt,
        mainDescription: plLifeNavigatorMainDescription
      }
    }
  };

  await i18next.init({
    resources: {
      en: { translation: enTranslations },
      pl: { translation: plTranslations }
    },
    lng: initialLang, // Set initial language based on Obsidian's setting
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

  // Force the language to match Obsidian's setting
  await i18next.changeLanguage(initialLang);

  // Listen for language changes in localStorage
  window.addEventListener('storage', (event) => {
    if (event.key === 'language' && event.newValue) {
      const newLang = event.newValue;
      console.debug('Language changed in Obsidian:', newLang);
      const mappedLang = langMap[newLang] || 'en';
      i18next.changeLanguage(mappedLang);
    }
  });

  return i18next;
};

export const t = (key: string, options?: TOptions) => {
  return i18next.t(key, options);
};

export const changeLanguage = async (lang: string) => {
  await i18next.changeLanguage(lang);
}; 