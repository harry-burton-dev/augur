// Inlines the shared data, engine, chrome and base CSS into each variant. node build.js
const fs = require("fs"), path = require("path");
const here = __dirname, out = path.join(here, "..");
const r = f => fs.readFileSync(path.join(here, f), "utf8");
const CSS = r("base.css"), JS = r("data.js") + "\n" + r("engine.js") + "\n" + r("chrome.js");
for (const f of fs.readdirSync(here).filter(f => /^v\d-.*\.html$/.test(f))) {
  const s = r(f).replace("/*@CSS*/", () => CSS).replace("/*@JS*/", () => JS);
  fs.writeFileSync(path.join(out, f), s);
  console.log("built", f);
}
