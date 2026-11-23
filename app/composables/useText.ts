/** Picks the right language from translatable jsonb text: UI locale, then the operator's languages. */
export function useText() {
  const { locale } = useI18n()
  const { languages } = useOperator()
  return (value: unknown) => pickText(value, locale.value, languages.value)
}
