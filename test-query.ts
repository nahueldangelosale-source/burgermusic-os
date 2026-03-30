import { getLeaderboard, getGlobalHealth, getCashflowOracle, getFireRadarAlerts } from './src/db/analytics-engine';

async function test() {
  try {
    console.log("Testing Leaderboard...");
    console.log(await getLeaderboard());
    
    console.log("Testing Health...");
    console.log(await getGlobalHealth());
    
    console.log("Testing Oracle...");
    console.log(await getCashflowOracle());
    
    console.log("Testing Radar...");
    console.log(await getFireRadarAlerts());
    
    console.log("ALL TESTS PASSED.");
    process.exit(0);
  } catch(e) {
    console.error("FAILED:", e);
    process.exit(1);
  }
}
test();
