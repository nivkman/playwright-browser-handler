import http from "node:http";

const PAGES = {
  "/": `<!doctype html><html><head><title>Home</title></head><body>
    <h1 id="title">Hello Playwright</h1>
    <a id="first" href="/page2">Page 2</a>
    <ul>
      <li><a class="item" href="/a">A</a></li>
      <li><a class="item" href="/b">B</a></li>
      <li><a class="item">no href</a></li>
    </ul>
    <button id="btn" onclick="document.getElementById('title').textContent='Clicked'">Click me</button>
    <button id="disabled" disabled>Nope</button>
    <input id="name" placeholder="name" />
    <a id="dl" href="/file.txt" download>Download</a>
    <div id="cookie"></div>
    <script>document.getElementById('cookie').textContent = document.cookie;</script>
  </body></html>`,
  "/page2": `<!doctype html><html><body><h1 id="title">Page 2</h1></body></html>`,
  "/tall": `<!doctype html><html><body style="margin:0"><div style="height:5000px"></div><p id="bottom">bottom</p></body></html>`,
};

/** Starts a fixture server on a random localhost port. */
export function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/file.txt") {
      res.writeHead(200, { "Content-Type": "text/plain", "Content-Disposition": 'attachment; filename="hello.txt"' });
      return res.end("hello from the server");
    }
    const html = PAGES[req.url];
    if (!html) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}
