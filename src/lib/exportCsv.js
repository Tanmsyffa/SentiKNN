import * as XLSX from 'xlsx';

function normalizedValue(value) {
  return Array.isArray(value) ? value.join(' | ') : String(value ?? '');
}

export function exportRowsToXlsx(filename, columns, rows, sheetName = 'Data') {
  const table = [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => normalizedValue(row[column.key]))),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(table);
  worksheet['!cols'] = columns.map((column) => ({
    wch: column.width || (column.key.includes('teks') || column.key.includes('step_') ? 52 : 20),
  }));
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 0), c: columns.length - 1 } }) };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename, { compression: true });
}
