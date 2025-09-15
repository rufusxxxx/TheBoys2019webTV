const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 3600 }); // кеш на 1 годину

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Головна сторінка
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Статичний список мобільних User-Agent
function getRandomMobileUserAgent() {
  const mobileUserAgents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6116.11 Mobile Safari/537.36",
    "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6116.11 Mobile Safari/537.36"
  ];
  return mobileUserAgents[Math.floor(Math.random() * mobileUserAgents.length)];
}

// API для отримання плеєрів
app.get("/api/data", async (req, res) => {
  const cachedData = cache.get("kinogoData");
  if (cachedData) return res.json(cachedData);

  try {
    const url = "https://kinogo.run/1606-pacany-serial.html";
    const userAgent = getRandomMobileUserAgent();

    const { data } = await axios.get(url, {
      headers: { "User-Agent": userAgent }
    });

    const $ = cheerio.load(data);

    const players = $("iframe")
      .map((i, el) => $(el).attr("src"))
      .get()
      .filter(src => src && src.startsWith("http") && !src.includes("google") && !src.includes("ad"));

    const responseData = {
      success: true,
      players,
      seasons: [
        { id: 1, title: "1 сезон (2019)" },
        { id: 2, title: "2 сезон (2020)" },
        { id: 3, title: "3 сезон (2022)" },
        { id: 4, title: "4 сезон (2024)" }
      ],
      timestamp: new Date().toISOString()
    };

    cache.set("kinogoData", responseData);
    res.json(responseData);

  } catch (error) {
    console.error("Помилка при парсингу:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Оновлення кешу
app.get("/api/refresh", (req, res) => {
  cache.del("kinogoData");
  res.json({ success: true, message: "Кеш очищено" });
});

// Статус API
app.get("/api/status", (req, res) => {
  const cachedData = cache.get("kinogoData");
  res.json({
    status: "ok",
    cached: !!cachedData,
    timestamp: new Date().toISOString()
  });
});

// Старт сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущено на http://localhost:${PORT}`);
});
