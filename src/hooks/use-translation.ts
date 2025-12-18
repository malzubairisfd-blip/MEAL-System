"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/context/language-context';

type Translations = { [key: string]: any };

// This function safely retrieves a nested key from an object.
const getNestedKey = (obj: Translations, key: string): string => {
  const keys = key.split('.');
  let result: any = obj;
  for (const k of keys) {
    result = result?.[k];
    if (result === undefined) {
      return key; // Return the key itself if translation is not found
    }
  }
  // Replace placeholders like {count}
  return result.toString();
};

export const useTranslation = () => {
  const { language } = useLanguage();
  const [translations, setTranslations] = useState<Translations>({});

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const module = await import(`@/locales/${language}.json`);
        setTranslations(module.default);
      } catch (error) {
        console.error(`Could not load translations for ${language}`, error);
        // Fallback to English if the selected language file is not found
        try {
            const fallbackModule = await import(`@/locales/en.json`);
            setTranslations(fallbackModule.default);
        } catch (fallbackError) {
            console.error(`Could not load fallback English translations`, fallbackError);
        }
      }
    };
    loadTranslations();
  }, [language]);

  const t = useCallback((key: string, replacements?: { [key: string]: string | number }): string => {
    let translated = getNestedKey(translations, key);
    if (replacements) {
        Object.keys(replacements).forEach(rKey => {
            translated = translated.replace(`{${rKey}}`, String(replacements[rKey]));
        });
    }
    return translated;
  }, [translations]);

  return { t, language };
};
