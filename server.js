/* eslint-disable @typescript-eslint/no-require-imports */
// Startup file for cPanel (Passenger / "Setup Node.js App"). Vercel ignores it.
// Passenger sets PORT; run `next build` before uploading.
const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port);
});
