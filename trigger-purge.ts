import { purgeDatabaseAction } from "./src/actions/purge-database";

async function main() {
  console.log("Triggering purge-database...");
  const res = await purgeDatabaseAction();
  console.log("RESULTADO PURGA:", res);
  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandled top level exception", err);
  process.exit(1);
});
