export const keepsakeLanguages = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'ja', name: 'Japanese' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese (Mandarin)' },
  { code: 'hi', name: 'Hindi' },
  { code: 'it', name: 'Italian' },
  { code: 'ko', name: 'Korean' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tr', name: 'Turkish' },
] as const;

export type KeepsakeLanguage = (typeof keepsakeLanguages)[number]['code'];
export type LocalizationGender = 'male' | 'female';

export function isKeepsakeLanguage(value: unknown): value is KeepsakeLanguage {
  return (
    typeof value === 'string' &&
    keepsakeLanguages.some((language) => language.code === value)
  );
}

export function keepsakeLanguageName(code: KeepsakeLanguage): string {
  return keepsakeLanguages.find((language) => language.code === code)?.name ?? code;
}
