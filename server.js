const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");
const fs = require("fs");

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

// Статика для фронтенду
app.use(express.static(path.join(__dirname, "public")));

// Додаємо middleware для обробки CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Маршрут для головної сторінки
app.get("/", (req, res) => {
  const htmlPath = path.join(__dirname, "public", "index.html");
  res.sendFile(htmlPath);
});

// API для отримання даних серіалу
app.get("/api/data", async (req, res) => {
  let browser;
  try {
    const url = "https://kinogo.run/1606-pacany-serial.html";

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process"
      ]
    });

    const page = await browser.newPage();

    // Мобільний UA + viewport
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    );
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector("ul.tabs li", { timeout: 10000 });

    // Плеєри
    const playerTabs = await page.$$("ul.tabs li");
    const players = [];
    
    for (let i = 0; i < playerTabs.length; i++) {
      try {
        await playerTabs[i].click();
        await page.waitForTimeout(3000); // Збільшуємо затримку для завантаження iframe
        
        const iframeSrcs = await page.$$eval(".box iframe", (iframes) =>
          iframes.map((f) => f.src).filter(src => src && !src.includes('google'))
        );
        
        players.push(...iframeSrcs);
      } catch (error) {
        console.error(`Помилка при обробці вкладки ${i}:`, error);
      }
    }

    // Сезони і серії
    const seasons = await page.$$eval(".season-list li", (lis) =>
      lis.map((li) => ({
        id: li.getAttribute("data-id") || li.textContent.trim(),
        title: li.textContent.trim()
      }))
    ).catch(() => []);

    const episodes = await page.$$eval(".episode-list li", (lis) =>
      lis.map((li) => ({
        id: li.getAttribute("data-id") || li.textContent.trim(),
        title: li.textContent.trim()
      }))
    ).catch(() => []);

    const localizations = await page.$$eval(".voice-selector option", (opts) =>
      opts.map((opt) => ({
        value: opt.value,
        label: opt.textContent.trim()
      }))
    ).catch(() => []);

    await browser.close();

    res.json({ 
      success: true,
      players: [...new Set(players)], // Видаляємо дублікати
      seasons, 
      episodes, 
      localizations 
    });
  } catch (error) {
    console.error("Помилка при парсингу:", error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ 
      success: false, 
      error: "Не вдалося отримати дані" 
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущено на http://localhost:${PORT}`);
});