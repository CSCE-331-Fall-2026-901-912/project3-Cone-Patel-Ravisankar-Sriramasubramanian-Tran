import express from "express";

const router = express.Router();

// Cache translations to avoid repeated DeepL API requests.
const translationCache = new Map();

router.post("/", async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    // Validate input.
    if (
      typeof text !== "string" ||
      !text.trim() ||
      typeof targetLang !== "string"
    ) {
      return res.status(400).json({
        error: "Valid text and targetLang are required.",
      });
    }

    const language = targetLang.toUpperCase();

    // Restrict requests to supported kiosk languages.
    const supportedLanguages = ["ES", "FR", "DE", "JA", "ZH"];

    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        error: "Unsupported language.",
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        error: "Text is too long.",
      });
    }

    // English is the original kiosk language.
    const cacheKey = JSON.stringify([text, language]);

    if (translationCache.has(cacheKey)) {
      return res.json({
        translatedText: translationCache.get(cacheKey),
      });
    }

    const apiKey = process.env.DEEPL_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: "Translation service is not configured.",
      });
    }

    const apiUrl = apiKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        source_lang: "EN",
        target_lang: language,
      }),
    });

    if (!response.ok) {
      console.error("DeepL API error:", response.status);

      return res.status(502).json({
        error: "Translation service request failed.",
      });
    }

    const data = await response.json();
    const translatedText = data.translations?.[0]?.text;

    if (!translatedText) {
      return res.status(502).json({
        error: "No translation returned.",
      });
    }

    translationCache.set(cacheKey, translatedText);

    return res.json({ translatedText });
  } catch (error) {
    console.error("Translation error:", error.message);

    return res.status(500).json({
      error: "Unable to translate text.",
    });
  }
});

export default router;