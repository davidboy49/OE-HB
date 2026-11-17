// Server-side "Export PDF" prints reports with headless Chrome (frontend/src/app/api/pdf).
// `npm install` downloads that browser into ./.cache/puppeteer inside this repo, so a new
// server needs no separate browser install - only Chrome's system libraries (see README).
const { join } = require("path");

module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
  chrome: { skipDownload: true }, // the full browser isn't needed, only the headless shell
  "chrome-headless-shell": { skipDownload: false },
};
