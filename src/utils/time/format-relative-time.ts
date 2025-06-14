import i18next from 'i18next';
import { t } from 'src/i18n';

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago", "3d ago")
 * For dates older than 7 days, shows the full date in the current locale
 */
export function formatRelativeTime(timestamp: number): string {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('time.justNow');
    if (diffMins < 60) return t('time.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('time.daysAgo', { count: diffDays });
    
    // For dates older than 7 days, use locale-specific formatting
    const currentLanguage = i18next.language || 'en';
    
    // Map i18next language codes to browser locale codes
    const localeMap: Record<string, string> = {
        'en': 'en-US',
        'pl': 'pl-PL',
        // Add more mappings as needed
    };
    
    const locale = localeMap[currentLanguage] || 'en-US';
    
    return past.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
} 