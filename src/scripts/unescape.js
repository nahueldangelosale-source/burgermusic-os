const fs = require("fs");
const files = ["src/db/sales-analytics.ts"];
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(/\\`/g, "`");
  s = s.replace(/\\\$/g, "$");
  s = s.replace(/\\{/g, "{");
  s = s.replace(/\\}/g, "}");
  fs.writeFileSync(f, s);
}
console.log("Unescaped sales-analytics successfully.");
