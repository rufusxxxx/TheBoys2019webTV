const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const UserAgent = require("user-agents");
const NodeCache = require("node-cache");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 3600 }); // кеш на 1 годину

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function getRandomMobileUserAgent() {
  const userAgent = new UserAgent([
    /Android/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i
  ]);
  return userAgent.toString();
}

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

app.get("/api/refresh", (req, res) => {
  cache.del("kinogoData");
  res.json({ success: true, message: "Кеш очищено" });
});

app.get("/api/status", (req, res) => {
  const cachedData = cache.get("kinogoData");
  res.json({
    status: "ok",
    cached: !!cachedData,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущено на http://localhost:${PORT}`);
});
