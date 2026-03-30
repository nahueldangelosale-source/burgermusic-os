import { ExcelRowSchema } from "./src/schemas/transactions";

const testRow = {
  cantidad: "1",
  precio: " $ 14,800.00 ",
  nroCaja: "362618",
  fecha: "1/2/26",
  descripcion: "ACDC Doble"
};

const result = ExcelRowSchema.safeParse(testRow);

if (!result.success) {
    console.error("FAILED:");
    console.error(JSON.stringify(result.error.issues, null, 2));
} else {
    console.log("SUCCESS:");
    console.log(result.data);
}
