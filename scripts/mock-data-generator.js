/**
 * Fuelog Mock Data Generator
 * Generates random fuel log data in TSV format for testing the import feature.
 * 
 * Usage: node scripts/mock-data-generator.js > mock_logs.tsv
 */

const brands = ['Circle K', 'Maxol', 'Applegreen', 'Texaco', 'Shell'];
const startDate = new Date(2023, 0, 1); // Jan 1, 2023
const endDate = new Date(); // Today
const numEntries = 50;

console.log('Date	Litres	Total Cost	Garage	Distance since fueled');

for (let i = 0; i < numEntries; i++) {
  // Random date between start and end
  const date = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
  const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  
  const litres = (30 + Math.random() * 20).toFixed(2); // 30-50L
  const cost = (litres * (1.5 + Math.random() * 0.3)).toFixed(2); // ~1.50-1.80 per litre
  const garage = brands[Math.floor(Math.random() * brands.length)];
  const distance = (400 + Math.random() * 300).toFixed(1); // 400-700km

  console.log(`${formattedDate}	${litres}	${cost}	${garage}	${distance}`);
}
