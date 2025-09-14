const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const chromium = require("chrome-aws-lambda");
const UserAgent = require('user-agents');
const NodeCache = require("node-cache");
const cors = require("cors");
const path = require("path");

// Додаємо плагіни
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 3600 }); // Кешування на 1 годину

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Маршрут для головної сторінки
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Функція для отримання випадкового мобільного User-Agent
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

// Функція для запуску браузера
async function getBrowser() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const browserOptions = {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
      "--no-first-run",
      "--disable-notifications",
      "--disable-popup-blocking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-breakpad",
      "--disable-client-side-phishing-detection",
      "--disable-default-apps",
      "--disable-hang-monitor",
      "--disable-ipc-flooding-protection",
      "--disable-prompt-on-repost",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--safebrowsing-disable-auto-update",
      "--mute-audio",
      "--no-default-browser-check",
      "--autoplay-policy=user-gesture-required",
      "--window-size=390,844"
    ],
    ignoreHTTPSErrors: true,
    timeout: 60000
  };

  // Додаємо executablePath для хмарного середовища
  if (isProduction) {
    browserOptions.executablePath = await chromium.executablePath;
    browserOptions.args = [...chromium.args, ...browserOptions.args];
  }

  return await puppeteer.launch(browserOptions);
}

// Функція для очікування завантаження контенту
function delay(time) {
  return new Promise(function(resolve) { 
    setTimeout(resolve, time);
  });
}

// API для отримання даних серіалу
app.get("/api/data", async (req, res) => {
  // Перевіряємо кеш
  const cachedData = cache.get("kinogoData");
  if (cachedData) {
    return res.json(cachedData);
  }

  let browser;
  try {
    const url = "https://kinogo.run/1606-pacany-serial.html";
    console.log("Запуск браузера для парсингу:", url);

    browser = await getBrowser();
    const page = await browser.newPage();

    // Встановлюємо випадковий мобільний User-Agent
    const userAgent = getRandomMobileUserAgent();
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 390, height: 844, isMobile: true });

    // Блокуємо непотрібні ресурси
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Додаємо обробник для виявлення капчі або блокувань
    page.on('response', response => {
      if (response.status() === 403 || response.status() === 503) {
        console.log('Можливе блокування доступу:', response.status());
      }
    });

    // Переходимо на сторінку
    console.log("Перехід на сторінку...");
    await page.goto(url, { 
      waitUntil: "networkidle0", 
      timeout: 60000 
    });

    // Чекаємо додатковий час для завантаження JavaScript
    await delay(5000);

    // Перевіряємо, чи не перенаправлено нас на іншу сторінку
    const currentUrl = page.url();
    if (!currentUrl.includes('kinogo.run') && !currentUrl.includes('1606-pacany-serial')) {
      throw new Error(`Перенаправлено на іншу сторінку: ${currentUrl}`);
    }

    console.log("Пошук плеєрів...");
    
    // Очікуємо завантаження вкладок з плеєрами
    await page.waitForSelector('ul.tabs li', { timeout: 15000 }).catch(() => {
      console.log("Вкладки не знайдені, спроба альтернативного пошуку");
    });

    // Отримуємо всі вкладки
    const playerTabs = await page.$$('ul.tabs li');
    console.log(`Знайдено вкладок: ${playerTabs.length}`);

    const players = [];
    
    // Обмежуємо кількість перевіряємих вкладок
    const maxTabsToCheck = Math.min(playerTabs.length, 5);
    
    for (let i = 0; i < maxTabsToCheck; i++) {
      try {
        console.log(`Обробка вкладки ${i + 1}/${maxTabsToCheck}`);
        
        // Клікаємо на вкладку
        await playerTabs[i].click();
        await delay(4000); // Чекаємо завантаження контенту
        
        // Шукаємо iframe
        const iframeSrc = await page.$eval('.box iframe', iframe => iframe.src).catch(() => null);
        
        if (iframeSrc && iframeSrc.startsWith('http')) {
          console.log(`Знайдено плеєр: ${iframeSrc}`);
          
          // Фільтруємо небажані джерела
          if (!iframeSrc.includes('google') && !iframeSrc.includes('ad.') && !iframeSrc.includes('doubleclick')) {
            players.push(iframeSrc);
          }
        }
        
        // Додатково шукаємо через eval для обходу захисту
        const iframeSources = await page.$$eval('iframe', iframes => 
          iframes.map(iframe => iframe.src).filter(src => src && src.startsWith('http'))
        );
        
        for (const src of iframeSources) {
          if (src && !players.includes(src) && 
              !src.includes('google') && !src.includes('ad.') && 
              !src.includes('doubleclick')) {
            console.log(`Додатковий плеєр: ${src}`);
            players.push(src);
          }
        }
      } catch (error) {
        console.error(`Помилка при обробці вкладки ${i}:`, error.message);
        continue;
      }
    }

    // Якщо не знайдено плеєрів через вкладки, шукаємо альтернативними методами
    if (players.length === 0) {
      console.log("Основний метод не знайшов плеєрів, спроба альтернативного пошуку");
      
      // Шукаємо всі iframe на сторінці
      const allIframes = await page.$$eval('iframe', iframes => 
        iframes.map(iframe => iframe.src).filter(src => src && src.startsWith('http'))
      );
      
      for (const src of allIframes) {
        if (src && !src.includes('google') && !src.includes('ad.') && 
            !src.includes('doubleclick') && !players.includes(src)) {
          console.log(`Альтернативний плеєр: ${src}`);
          players.push(src);
        }
      }
    }

    // Перевіряємо знайдені плеєри
    const validPlayers = players.filter(player => 
      player && player.length > 0 && 
      (player.includes('http') || player.includes('//'))
    );

    console.log(`Знайдено плеєрів: ${validPlayers.length}`);

    // Закриваємо браузер
    await browser.close();

    // Готуємо дані для відповіді
    const responseData = {
      success: true,
      players: validPlayers,
      seasons: [
        { id: 1, title: "1 сезон (2019)" },
        { id: 2, title: "2 сезон (2020)" },
        { id: 3, title: "3 сезон (2022)" },
        { id: 4, title: "4 сезон (2024)" }
      ],
      episodes: [],
      localizations: [],
      timestamp: new Date().toISOString()
    };

    // Зберігаємо в кеш
    cache.set("kinogoData", responseData);

    // Відправляємо відповідь
    res.json(responseData);

  } catch (error) {
    console.error("Помилка при парсингу:", error);
    
    if (browser) {
      await browser.close();
    }

    // Спроба використати резервний метод з іншим User-Agent
    try {
      console.log("Спроба резервного методу парсингу...");
      
      const backupBrowser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
      
      const backupPage = await backupBrowser.newPage();
      await backupPage.setUserAgent("Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36");
      
      await backupPage.goto("https://kinogo.run/1606-pacany-serial.html", {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });
      
      await delay(5000);
      
      // Спрощений пошук iframe
      const backupPlayers = await backupPage.$$eval('iframe', iframes => 
        iframes.map(iframe => iframe.src).filter(src => src && src.startsWith('http') && !src.includes('google'))
      );
      
      await backupBrowser.close();
      
      if (backupPlayers.length > 0) {
        const responseData = {
          success: true,
          players: backupPlayers,
          seasons: [
            { id: 1, title: "1 сезон (2019)" },
            { id: 2, title: "2 сезон (2020)" },
            { id: 3, title: "3 сезон (2022)" },
            { id: 4, title: "4 сезон (2024)" }
          ],
          episodes: [],
          localizations: [],
          timestamp: new Date().toISOString(),
          note: "Дані отримано резервним методом"
        };
        
        cache.set("kinogoData", responseData);
        return res.json(responseData);
      }
    } catch (backupError) {
      console.error("Резервний метод також не вдався:", backupError);
    }

    // У разі повного провалу
    res.status(500).json({ 
      success: false, 
      error: "Не вдалося отримати дані з kinogo.run",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Додатковий API для примусового оновлення даних
app.get("/api/refresh", async (req, res) => {
  cache.del("kinogoData");
  res.json({ success: true, message: "Кеш очищено, дані будуть оновлені при наступному запиті" });
});

// Статус API
app.get("/api/status", (req, res) => {
  const cachedData = cache.get("kinogoData");
  res.json({
    status: "ok",
    cached: !!cachedData,
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage()
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущено на http://localhost:${PORT}`);
  console.log(`⏰ Час запуску: ${new Date().toISOString()}`);
});

// Обробка помилок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});