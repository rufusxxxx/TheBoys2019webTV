Kinogo Scraper + Player - local pack
===================================

Files included:
- package.json
- server.js
- public/index.html

Purpose:
- server.js scrapes the target page and extracts iframe player srcs and simple locale hints.
- public/index.html is a single-page frontend that calls /api/episodes and lets you pick episodes and players.

Run locally:
1. Install Node.js (16+).
2. In the project directory:
   npm install
   npm start
3. Open http://localhost:3000

Deploying to Render.com:
- Create a new Web Service in Render.
- Connect your Git repo (push this project to a repo first).
- Set Build Command: `npm install`
- Set Start Command: `npm start`
- Make sure Render's PORT environment variable is accepted (server uses process.env.PORT).
- Deploy.

Notes & legal:
- You confirmed you have the rights to access the content.
- Be careful with scraping frequency and bandwidth; adjust schedule if necessary.
- If providers block embedding, implement a stream proxy or respect provider rules.
