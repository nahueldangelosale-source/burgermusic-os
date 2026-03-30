const fs = require("fs");
const files = ["src/actions/procurement-actions.ts", "src/db/matching-engine.ts"];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(/\\`/g, "`");
  s = s.replace(/\\\$/g, "$");
  s = s.replace(/\\{/g, "{");
  s = s.replace(/\\}/g, "}");
  fs.writeFileSync(f, s);
}
console.log("Unescaped Procurement Engine.");
