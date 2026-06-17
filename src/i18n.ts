import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./i18n/en.json";
import de from "./i18n/de.json";
import fr from "./i18n/fr.json";
import uk from "./i18n/uk.json";
import ru from "./i18n/ru.json";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
    uk: { translation: uk },
    ru: { translation: ru },
  },
  lng: "ru",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
