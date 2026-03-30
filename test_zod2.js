const { z } = require('zod');
const ExcelRowSchema = z.object({
  cantidad: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return NaN;
    return val;
  }, z.coerce.number()),
  precio: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return NaN;
    if (typeof val === 'string') {
        let clean = val.replace(/\$/g, '').replace(/\s/g, '');
        return Number(clean);
    }
    return val;
  }, z.coerce.number()),
  nroCaja: z.coerce.string().catch('1'),
  fecha: z.preprocess((val) => {
    if (typeof val === 'number') {
      const step = val > 59 ? 25569 : 25568;
      return new Date((val - step) * 86400 * 1000).toISOString().split('T')[0];
    }
    return val;
  }, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Requiere YYYY-MM-DD.')),
  descripcion: z.coerce.string().trim().transform(v => v === '' ? 'MISC_UNKNOWN' : v).catch('MISC_UNKNOWN')
});
const testRow = {
  cantidad: 1,
  precio: 14800,
  nroCaja: 362618,
  fecha: 46024,
  descripcion: 'ACDC Doble'
};
console.log(JSON.stringify(ExcelRowSchema.safeParse(testRow), null, 2));
