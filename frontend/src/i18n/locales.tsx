import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en" | "zh-CN";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "skill-manager:locale";

export const SUPPORTED_LOCALES: readonly { value: Locale; label: string; nativeLabel: string }[] = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "zh-CN", label: "Chinese", nativeLabel: "中文" },
];

export type CopyShape<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => CopyShape<Result>
  : T extends string
    ? string
    : T extends number | boolean | null | undefined
      ? T
      : T extends readonly (infer Item)[]
        ? CopyShape<Item>[]
        : { [Key in keyof T]: CopyShape<T[Key]> };

export type LocalizedCopy<T> = {
  en: CopyShape<T>;
  "zh-CN": CopyShape<T>;
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  supportedLocales: typeof SUPPORTED_LOCALES;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN";
}

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* noop - storage may be unavailable */
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === "undefined" ? DEFAULT_LOCALE : readStoredLocale(),
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      supportedLocales: SUPPORTED_LOCALES,
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context) {
    return context;
  }
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => undefined,
    supportedLocales: SUPPORTED_LOCALES,
  };
}

export function useLocalizedCopy<T>(copy: LocalizedCopy<T>): CopyShape<T> {
  const { locale } = useLocale();
  return copy[locale] ?? copy.en;
}
