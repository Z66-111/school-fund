/* eslint-disable @typescript-eslint/no-require-imports */
// Startup file for cPanel (Passenger / "Setup Node.js App"). Vercel ignores it.
// Run `next build` before uploading.
const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "", 10) || 3000;
const underPassenger = typeof PhusionPassenger !== "undefined";

// When a form action ends in a redirect (logging in, for one), Next fetches the target page from
// its own address and forwards the visitor's cookies with that request. Left alone it assumes
// http://localhost:3000, which under Passenger is not this app: at best nothing is there, at
// worst it is another program on the same shared host. So say where the app really is:
//   APP_ORIGIN (e.g. https://angisan.mn) when set, otherwise this process's own port.
// Under Passenger there is no port of our own, so without APP_ORIGIN point at a closed port:
// the fetch fails at once and Next falls back to an ordinary browser redirect.
const origin = (process.env.APP_ORIGIN || "").replace(/\/+$/, "");
if (origin) process.env.__NEXT_PRIVATE_ORIGIN = origin;
else if (underPassenger) process.env.__NEXT_PRIVATE_ORIGIN = "http://127.0.0.1:9";

const app = next({ dev: false, hostname: "localhost", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port);
});
