const fs = require("fs");
const files = [
  "src/app/(dashboard)/command-center/ClientLeaderboard.tsx",
  "src/app/(dashboard)/command-center/OracleChart.tsx",
  "src/app/(dashboard)/command-center/page.tsx",
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
console.log("Unescaped Command Center safely.");
