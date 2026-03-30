
import { getSuppliers } from "./src/actions/suppliers";

async function main() {
  // Mock session similar to Executive Oracle
  const mockUser = { id: "USR_DEBUG", name: "Debugger", role: "C_LEVEL", storeId: "global" };
  
  // We cannot easily call the server action directly because it's wrapped in authenticatedAction
  // which expects a real session from cookies.
  // But we can try to call the underlying withTenant logic.
}
