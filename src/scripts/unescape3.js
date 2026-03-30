const fs = require("fs");
const files = ["src/app/(dashboard)/sales/ChannelChart.tsx", "src/app/(dashboard)/sales/page.tsx"];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(/\\`/g, "`");
  s = s.replace(/\\\$/g, "$");
  s = s.replace(/\\{/g, "{");
  s = s.replace(/\\}/g, "}");
  fs.writeFileSync(f, s);
}
console.log("Unescaped Sales Dashboard.");
