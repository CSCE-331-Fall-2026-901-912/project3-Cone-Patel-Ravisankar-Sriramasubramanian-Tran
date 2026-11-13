
import express from "express";

const router = express.Router();

// Cache images to avoid repeated Unsplash API requests.
const imageCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000;


function getDrinkSearchTerm(drinkName) {
  const name = drinkName.toLowerCase();

  // Use a few reusable search terms instead of
  // searching for every exact menu item.

  if (name.includes("matcha")) {
    return "matcha latte cup";
  }

  if (name.includes("taro")) {
    return "purple bubble tea";
  }

  if (name.includes("coffee")) {
    return "iced coffee cup";
  }

  if (name.includes("fruit") ||
      name.includes("mango") ||
      name.includes("strawberry") ||
      name.includes("peach") ||
      name.includes("passion") ||
      name.includes("watermelon") ||
      name.includes("lemon")) {
    return "fruit bubble tea cup";
  }

  if (name.includes("blended") ||
      name.includes("oreo")) {
    return "bubble tea milkshake cup";
  }

  return "bubble tea cup";
}


// GET /api/images?query=milk%20tea
router.get("/", async (req, res) => {
  const query = String(req.query.query || "").trim();

  if (!query || query.length > 100) {
    return res.status(400).json({
      error: "A valid image search query is required",
    });
  }

  const searchTerm = getDrinkSearchTerm(query);
const cached = imageCache.get(searchTerm);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return res.json(cached.data);
  }

  if (!process.env.UNSPLASH_ACCESS_KEY) {
    return res.status(503).json({
      error: "Unsplash API key is not configured",
    });
  }

  try {
    const params = new URLSearchParams({
      query: searchTerm,
      per_page: "5",
      orientation: "squarish",
    });

    const response = await fetch(
      `https://api.unsplash.com/search/photos?${params}`,
      {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
          "Accept-Version": "v1",
        },
      }
    );

    if (!response.ok) {
      console.error("Unsplash API status:", response.status);
      return res.status(502).json({
        error: "Unable to retrieve an image from Unsplash",
      });
    }

    const result = await response.json();

const photos = result.results || [];

const drinkWords = [
  "bubble tea",
  "boba",
  "milk tea",
  "iced tea",
  "matcha latte",
  "iced coffee",
  "latte",
  "smoothie",
  "milkshake",
  "beverage",
  "drink",
];

const photo =
  photos.find((item) => {
    const description = [
      item.alt_description,
      item.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return drinkWords.some((word) => description.includes(word));
  }) || null;


    const data = photo
      ? {
          imageUrl: photo.urls.small,
          alt: photo.alt_description || `${query} drink`,
          photographer: photo.user.name,
          photographerUrl: photo.user.links.html,
          unsplashUrl: photo.links.html,
          downloadLocation: photo.links.download_location,
        }
      : {
          imageUrl: null,
          alt: `No image found for ${query}`,
        };

    imageCache.set(searchTerm, {
      data,
      timestamp: Date.now(),
    });

    res.json(data);
  } catch (error) {
    console.error("Image API error:", error);
    res.status(500).json({
      error: "Failed to fetch image",
    });
  }
});

export default router;
