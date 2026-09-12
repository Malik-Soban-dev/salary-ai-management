import { readFileSync, writeFileSync } from "node:fs";

const shell = readFileSync("apps/demo-standalone/shell.html", "utf8");
const engine = readFileSync("apps/demo-standalone/engine.bundle.js", "utf8");
const app = readFileSync("apps/demo-standalone/demo-app.js", "utf8");
const safe = (s) => s.replaceAll("</script>", "<\\/script>");
const out = shell.replace("/* __ENGINE__ */", safe(engine)).replace("/* __DEMO_APP__ */", safe(app));
writeFileSync("apps/demo-standalone/index.html", out);
console.log("apps/demo-standalone/index.html written:", out.length, "bytes");
