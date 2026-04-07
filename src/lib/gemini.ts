import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const SUPPORTED_LANGUAGES = [
  { code: 'vi-VN', name: 'Vietnamese', label: 'VI' },
  { code: 'en-US', name: 'English', label: 'EN' },
  { code: 'zh-CN', name: 'Mandarin Chinese', label: 'ZH' },
  { code: 'fr-FR', name: 'French', label: 'FR' },
  { code: 'es-ES', name: 'Spanish', label: 'ES' },
];

export async function translateText(text: string, fromLang: string, toLang: string) {
  if (!text.trim()) return "";
  
  const fromName = SUPPORTED_LANGUAGES.find(l => l.code === fromLang)?.name || fromLang;
  const toName = SUPPORTED_LANGUAGES.find(l => l.code === toLang)?.name || toLang;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following ${fromName} text to natural, daily ${toName} for a senior person traveling. Keep it simple and clear. Only return the translation.\n\n${fromName}: ${text}`,
    });
    
    return response.text?.trim() || "Translation failed.";
  } catch (error) {
    console.error("Translation error:", error);
    return "Error: Could not connect to translation service.";
  }
}

export async function generateSpeech(text: string, langCode: string) {
  try {
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.name || langCode;
    // Simpler, more direct prompt for the TTS model
    const prompt = `Read this text in ${langName}: "${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      console.warn("Gemini TTS returned no audio data");
    }
    return base64Audio;
  } catch (error) {
    console.error("Speech generation error:", error);
    return null;
  }
}
