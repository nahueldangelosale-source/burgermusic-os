const fs = require("fs");
const files = [
  "src/lib/utils/dinamica-parser.ts",
  "src/db/treasury-queries.ts",
  "src/actions/cashflow-predictor.ts",
  "src/db/schema.ts",
];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(/\\`/g, "`");
  s = s.replace(/\\\$/g, "$");
  s = s.replace(/\\{/g, "{");
  s = s.replace(/\\}/g, "}");
  fs.writeFileSync(f, s);
}
console.log("Unescaped Treasury Engines.");
