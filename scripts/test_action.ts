import { getSellableProducts } from "../src/actions/bom-simulator";

async function run() {
  console.log("Calling getSellableProducts...");
  const res = await getSellableProducts();
  console.log("Result length:", res.length);
  if (res.length > 0) {
    console.log("First item:", JSON.stringify(res[0], null, 2));
  }
  process.exit(0);
}

run();
