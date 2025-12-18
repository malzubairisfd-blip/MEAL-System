"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/context/language-context';

type Translations = { [key: string]: any };

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
        const fallbackModule = await import(`@/locales/en.json`);
        setTranslations(fallbackModule.default);
      }
    };
    loadTranslations();
  }, [language]);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let result: any = translations;
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) {
        return key; // Return the key itself if translation is not found
      }
    }
    return result || key;
  }, [translations]);

  return { t, language };
};
