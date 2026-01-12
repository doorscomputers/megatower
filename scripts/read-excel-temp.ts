import * as XLSX from 'xlsx';

// Read 2ND FLOOR December.xlsx
console.log("=== Reading 2ND FLOOR December.xlsx ===\n");
const wb1 = XLSX.readFile('c:/Users/Warenski/Desktop/MEGATOWER I&II/December/2ND FLOOR December.xlsx');
console.log('Sheet names:', wb1.SheetNames);

wb1.SheetNames.forEach(name => {
  console.log(`\n--- Sheet: ${name} ---`);
  const sheet = wb1.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  for (let i = 0; i < Math.min(35, data.length); i++) {
    if (data[i] && data[i].length > 0) {
      console.log(`${i}: ${JSON.stringify(data[i]).substring(0, 280)}`);
    }
  }
});

console.log("\n\n=== Reading DECEMBER 2025.xlsx ===\n");
const wb2 = XLSX.readFile('c:/Users/Warenski/Desktop/MEGATOWER I&II/December/DECEMBER 2025.xlsx');
console.log('Sheet names:', wb2.SheetNames);

wb2.SheetNames.forEach(name => {
  console.log(`\n--- Sheet: ${name} ---`);
  const sheet = wb2.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  for (let i = 0; i < Math.min(35, data.length); i++) {
    if (data[i] && data[i].length > 0) {
      console.log(`${i}: ${JSON.stringify(data[i]).substring(0, 300)}`);
    }
  }
});
