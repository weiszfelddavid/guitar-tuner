import { useParams } from 'react-router-dom';
import type { TranslationSchema } from '../types/translations';

import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';
import de from '../locales/de.json';
import it from '../locales/it.json';
import ru from '../locales/ru.json';
import ja from '../locales/ja.json';
import zh from '../locales/zh.json';
import ko from '../locales/ko.json';

// We assert the type here because JSON imports are loosely typed by default
const locales: Record<string, TranslationSchema> = { 
  en, es, fr, pt, de, it, ru, ja, zh, ko 
} as unknown as Record<string, TranslationSchema>;

export const useTranslation = () => {
  const { lang = 'en' } = useParams();
  const translations = locales[lang] || locales.en;

  // We keep 'path' as string to avoid over-engineering the dot-notation type for now,
  // but at least 'translations' is strongly typed.
  const t = (path: string, defaultValue?: string): string => {
    const keys = path.split('.');
    let value: any = translations;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key as keyof typeof value];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined) {
      // Fallback to English
      let fallbackValue: any = locales.en;
      for (const key of keys) {
        if (fallbackValue && typeof fallbackValue === 'object') {
          fallbackValue = fallbackValue[key as keyof typeof fallbackValue];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      return (typeof fallbackValue === 'string' ? fallbackValue : defaultValue) || path;
    }

    return typeof value === 'string' ? value : path;
  };

  return { t, lang, translations };
};