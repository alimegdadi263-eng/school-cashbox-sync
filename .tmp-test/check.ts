import ExcelJS from "exceljs";
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("/tmp/out_newperiods.xlsx");
const ws = wb.worksheets[0];
const lastCol = ws.columnCount;
console.log("columnCount:", lastCol);
console.log("H3 last:", ws.getCell(3, lastCol).value, "| H4:", ws.getCell(4, lastCol).value);
for (const r of [5, 6]) {
  const row = ws.getRow(r);
  console.log("row", r, "name:", row.getCell(3).value, "| total cell:", JSON.stringify(row.getCell(lastCol).value));
}
