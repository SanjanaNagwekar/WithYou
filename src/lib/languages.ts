export const keepsakeLanguages = [
  { code: 'en', name: 'English', accent: null },
  { code: 'de', name: 'German', accent: 'standard-german' },
  { code: 'es', name: 'Spanish (Spain)', accent: 'castilian' },
  { code: 'fr', name: 'French (France)', accent: 'parisian' },
  { code: 'ja', name: 'Japanese', accent: 'standard-japanese' },
  { code: 'pt', name: 'Portuguese (Brazil)', accent: 'brazilian-portuguese' },
  { code: 'zh', name: 'Chinese (Mandarin)', accent: 'mandarin' },
  { code: 'hi', name: 'Hindi', accent: 'standard-hindi' },
  { code: 'it', name: 'Italian', accent: 'standard-italian' },
  { code: 'ko', name: 'Korean', accent: 'korean' },
  { code: 'nl', name: 'Dutch', accent: 'randstad' },
  { code: 'pl', name: 'Polish', accent: 'polish' },
  { code: 'ru', name: 'Russian', accent: 'russian' },
  { code: 'sv', name: 'Swedish', accent: 'stockholm' },
  { code: 'tr', name: 'Turkish', accent: 'istanbul' },
] as const;

export type KeepsakeLanguage = (typeof keepsakeLanguages)[number]['code'];

export function isKeepsakeLanguage(value: unknown): value is KeepsakeLanguage {
  return (
    typeof value === 'string' &&
    keepsakeLanguages.some((language) => language.code === value)
  );
}

export function keepsakeLanguageName(code: KeepsakeLanguage): string {
  return keepsakeLanguages.find((language) => language.code === code)?.name ?? code;
}

export function keepsakeLocalizationAccent(
  code: Exclude<KeepsakeLanguage, 'en'>,
): string {
  const language = keepsakeLanguages.find((candidate) => candidate.code === code);
  if (!language?.accent) throw new Error(`No localization accent configured for ${code}.`);
  return language.accent;
}
