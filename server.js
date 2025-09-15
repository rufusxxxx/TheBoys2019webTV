const express = require("express");
const puppeteer = require("puppeteer-core");
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const UserAgent = require("user-agents");
const NodeCache = require("node-cache");
const cors = require("cors");
const path = require("path");

// Додаємо плагіни
puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(AdblockerPlugin({ blockTrackers: true }));

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 3600 }); // Кешування на 1 годину

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Головна сторінка
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Отримання випадкового мобільного User-Agent
function getRandomMobileUserAgent() {
  const userAgent = new UserAgent([
    /Android/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
  ]);
  return userAgent.toString();
}

// Запуск браузера (через системний Chrome Render)
async function getBrowser() {
  return await puppeteerExtra.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

// Затримка
function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// API для отримання даних
app.get("/api/data", async (req, res) => {
  const cachedData = cache.get("kinogoData");
  if (cachedData) {
    return res.json(cachedData);
  }

  let browser;
  try {
    const url = "https://kinogo.run/1606-pacany-serial.html";
    browser = await getBrowser();
    const page = await browser.newPage();

    const userAgent = getRandomMobileUserAgent();
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const resourceType = request.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await delay(5000);

    const players = await page.$$eval("iframe", (iframes) =>
      iframes
        .map((f) => f.src)
        .filter(
          (src) =>
            src &&
            src.startsWith("http") &&
            !src.includes("google") &&
            !src.includes("doubleclick") &&
            !src.includes("ad.")
        )
    );

    await browser.close();

    const responseData = {
      success: true,
      players,
      seasons: [
        { id: 1, title: "1 сезон (2019)" },
        { id: 2, title: "2 сезон (2020)" },
        { id: 3, title: "3 сезон (2022)" },
        { id: 4, title: "4 сезон (2024)" },
      ],
      timestamp: new Date().toISOString(),
    };

    cache.set("kinogoData", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Помилка при парсингу:", error);
    if (browser) await browser.close();
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
    timestamp: new Date().toISOString(),
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущено на http://localhost:${PORT}`);
});
