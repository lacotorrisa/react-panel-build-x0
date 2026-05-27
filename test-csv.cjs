const fs = require('fs');

const parseCSVData = (text) => {
  const result = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // omitir comilla escapada
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++; // saltar \n de \r\n
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) result.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else if (char === '\r' && !inQuotes) {
      // Ignorar carriage return fuera de comillas
    } else {
      currentCell += char;
    }
  }
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c !== '')) result.push(currentRow);
  }
  return result;
}

const file = fs.readFileSync('F:/Descargas/Pedidos Final - plantilla_pedidos (2).csv (1).csv', 'utf8');
const rows = parseCSVData(file);

console.log("Headers:", rows[0]);
console.log("Row 1 length:", rows[1].length, rows[1]);
