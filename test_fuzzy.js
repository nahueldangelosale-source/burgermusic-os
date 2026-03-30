const normalize = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase().trim();

const dbCatalog = [
  "Punk-er Doble", "Beatle Doble", "Mala-Fama Doble", "A.C.D.C. Doble", "Clasic Doble", "Charly Simple", "Beatle Simple", "Dip Cheddar", "Nuggets 6", "Nuggets 12"
];

const excelMisses = [
  "dip de cheddar", "Porcion Extra de Papas Medianas", "Papas con Cheddar", "Nugget's X6 ", "NUGGETS X12 + PAPAS + BBQ", "Mala Fama Doble 220g", "ENVIO", "Clasic Doble 220g", "Charly Simple 110g", "Beatle Doble 220g"
];

const dict = new Map();
for (const c of dbCatalog) dict.set(normalize(c), c);

for (const m of excelMisses) {
  const normM = normalize(m);
  let matched = dict.get(normM);
  
  if (!matched) {
    for (const [k, v] of dict.entries()) {
      if (normM.includes(k) || k.includes(normM)) {
         matched = v;
         break;
      }
    }
  }
  
  console.log(m, "->", matched || "MISS");
}
