// src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslation from "./locales/en/translation.json";
import hiTranslation from "./locales/hi/translation.json";

const LANG_STORAGE_KEY = "hms_lang";

function detectInitialLanguage() {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch {
    // ignore
  }

  try {
    const match = document.cookie.match(
      /(?:^|;)\s*hms_lang=([^;]+)/
    );
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // ignore
  }

  return "en";
}

const initialLng = detectInitialLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslation },
    hi: { translation: hiTranslation },
  },
  lng: initialLng,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export { LANG_STORAGE_KEY };
export default i18n;