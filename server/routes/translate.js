import express from "express";

const router = express.Router();

// Cache translations to avoid repeated DeepL API requests.
const translationCache = new Map();
const MAX_TEXTS_PER_REQUEST = 50;
const MAX_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(retryAfter, attempt) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const requestedDelay = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now();

    if (Number.isFinite(requestedDelay) && requestedDelay > 0) {
      return Math.min(requestedDelay, 5000);
    }
  }

  return 500 * (2 ** attempt);
}

router.post("/", async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    const isBatch = Array.isArray(text);
    const texts = isBatch ? text : [text];
    const hasValidTexts = isBatch
      ? text.length > 0 &&
        text.length <= MAX_TEXTS_PER_REQUEST &&
        texts.every((value) => typeof value === "string" && value.trim())
      : typeof text === "string" && text.trim();

    // Validate input.
    if (!hasValidTexts || typeof targetLang !== "string") {
      return res.status(400).json({
        error: `Valid text${isBatch ? " array" : ""} and targetLang are required.`,
      });
    }

    if (texts.some((value) => value.length > 5000)) {
      return res.status(400).json({
        error: "Text is too long.",
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

    // English is the original kiosk language.
    const cacheKey = (value) => JSON.stringify([value, language]);
    const missingTexts = [
      ...new Set(texts.filter((value) => !translationCache.has(cacheKey(value)))),
    ];

    if (missingTexts.length > 0) {
      const apiKey = process.env.DEEPL_API_KEY;

      if (!apiKey) {
        return res.status(503).json({
          error: "Translation service is not configured.",
        });
      }

      const apiUrl = apiKey.endsWith(":fx")
        ? "https://api-free.deepl.com/v2/translate"
        : "https://api.deepl.com/v2/translate";

      let response;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
          response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              Authorization: `DeepL-Auth-Key ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: missingTexts,
              source_lang: "EN",
              target_lang: language,
            }),
          });
        } catch (error) {
          if (attempt === MAX_RETRIES) throw error;
          await wait(500 * (2 ** attempt));
          continue;
        }

        if (response.ok) break;

        const errorBody = await response.text();
        if (
          !RETRYABLE_STATUSES.has(response.status) ||
          attempt === MAX_RETRIES
        ) {
          console.error("DeepL API error:", {
            status: response.status,
            body: errorBody.slice(0, 500),
          });

          return res.status(502).json({
            error: "Translation service request failed.",
          });
        }

        await wait(retryDelay(response.headers.get("retry-after"), attempt));
      }

      const data = await response.json();
      const translatedItems = data.translations;

      if (
        !Array.isArray(translatedItems) ||
        translatedItems.length !== missingTexts.length ||
        translatedItems.some(
          (item) => typeof item?.text !== "string" || !item.text.trim()
        )
      ) {
        return res.status(502).json({
          error: "No translation returned.",
        });
      }

      missingTexts.forEach((value, index) => {
        translationCache.set(cacheKey(value), translatedItems[index].text);
      });
    }

    if (isBatch) {
      return res.json({
        translations: texts.map((value) => ({
          text: value,
          translatedText: translationCache.get(cacheKey(value)),
        })),
      });
    }

    return res.json({
      translatedText: translationCache.get(cacheKey(text)),
    });
  } catch (error) {
    console.error("Translation error:", error.message);

    return res.status(500).json({
      error: "Unable to translate text.",
    });
  }
});

export default router;