// Hook for machine translation of posts (admin-console.md, "News").
//
// No provider is chosen yet (cost and privacy are open questions), so this
// returns null and the UI says suggestions are not available. A provider
// implementation returns the suggested text; the editor marks it as
// machine-translated until a person edits it.

export interface TranslationRequest {
  text: string
  from: string
  to: string
}

export type Translator = (request: TranslationRequest) => Promise<string | null>

export const noTranslator: Translator = async () => null

export const translationAvailable = false
