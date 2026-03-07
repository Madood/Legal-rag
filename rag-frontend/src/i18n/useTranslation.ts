import { useContext } from 'react';
import { LanguageContext } from './LanguageContext';
import { translations } from './translations';

export function useTranslation() {
  const { lang, changeLang } = useContext(LanguageContext);

  const t = (key: string): string => {
    const keys = key.split('.');
    let val: any = translations[lang];
    for (const k of keys) val = val?.[k];
    if (val === undefined || typeof val !== 'string') {
      let fb: any = translations['en'];
      for (const k of keys) fb = fb?.[k];
      return typeof fb === 'string' ? fb : key;
    }
    return val;
  };

  return { t, lang, changeLang };
}
