import { InitOptions } from 'i18next';
import { DEFAULT_LOCALE, NAMESPACES } from './locales';
import { resources } from './resources';

export const i18nConfig: InitOptions = {
  resources,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: NAMESPACES as unknown as string[],
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  react: {
    useSuspense: false, // React Native does not support Suspense with i18next out-of-the-box
  },
};
