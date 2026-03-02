import { useAppStore } from '../store/useAppStore';
import { en } from './en';
import { ja } from './ja';

const dictionaries = { en, ja };

export type TranslationKey = keyof typeof ja;

/**
 * A hook that returns a translation function `t` which uses the current application language setting.
 */
export function useTranslation() {
    // We assume useAppStore provides a way to get the language. If missing, we fallback to 'ja'
    // This requires SettingsTab or App to write settings.language to the store or DB.
    const getLanguage = useAppStore(state => (state as any).globalSettings?.language ?? 'ja');
    const language = getLanguage as 'en' | 'ja';
    const dictionary = dictionaries[language] || dictionaries.ja;

    const t = (key: TranslationKey, fallback?: string): string => {
        return dictionary[key] ?? fallback ?? key;
    };

    return { t, language };
}
