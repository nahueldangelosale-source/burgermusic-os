const xlsx = require('xlsx'); 
const wb = xlsx.readFile('ventas_BurgerMusic_al 4.3.2026.xlsx'); 
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:false});
console.log(JSON.stringify(data.slice(0, 10), null, 2));
