const fs = require("fs");
const files = [
  "src/actions/receive-actions.ts",
  "src/app/(mobile)/receive/page.tsx",
  "src/app/(mobile)/receive/BlindReceiveForm.tsx",
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
console.log("Unescaped UI boundaries.");
