import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Log } from './types';
import { formatMPG } from './calculations';

/**
 * Generates and saves a PDF report of the fuel history.
 * @param logs Array of logs to include in the report.
 * @param userName Name of the user (e.g., for the header).
 * @param dateRange Description of the date range (e.g., "01/01/2024 - 31/01/2024").
 */
export const exportLogsToPDF = (logs: Log[], userName: string, dateRange: string) => {
  const doc = new jsPDF();

  // --- PDF Styling & Header ---
  const primaryColor = [79, 70, 229]; // indigo-600
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Fuelog History Report', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`User: ${userName}`, 14, 30);
  doc.text(`Date Range: ${dateRange}`, 14, 35);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 40);

  // --- Summary Section ---
  const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const totalDist = logs.reduce((sum, log) => sum + (log.distanceKm || 0), 0);
  const totalFuel = logs.reduce((sum, log) => sum + (log.fuelAmountLiters || 0), 0);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Summary Metrics:', 14, 55);
  
  doc.setFontSize(10);
  doc.text(`Total Distance: ${totalDist.toFixed(1)} Km`, 14, 65);
  doc.text(`Total Fuel Added: ${totalFuel.toFixed(2)} Litres`, 80, 65);
  doc.text(`Total Cost (Home): €${totalCost.toFixed(2)}`, 14, 70);
  
  const avgEfficiency = totalDist > 0 && totalFuel > 0 ? formatMPG(totalDist, totalFuel) : 'N/A';
  doc.text(`Average Efficiency: ${avgEfficiency} MPG (UK)`, 80, 70);

  // --- Table Generation ---
  const tableHeaders = [['Date', 'Brand', 'Cost (Home)', 'Original Cost', 'Dist (Km)', 'Fuel (L)', 'MPG']];
  const tableData = logs.map(log => [
    log.timestamp?.toDate().toLocaleDateString('en-IE') ?? 'N/A',
    log.brand || 'Unknown',
    `€${log.cost?.toFixed(2)}`,
    log.currency && log.currency !== 'EUR' ? `${log.originalCost?.toFixed(2)} ${log.currency}` : '-',
    log.distanceKm?.toFixed(1),
    log.fuelAmountLiters?.toFixed(2),
    formatMPG(log.distanceKm, log.fuelAmountLiters)
  ]);

  autoTable(doc, {
    startY: 80,
    head: tableHeaders,
    body: tableData,
    headStyles: { fillColor: primaryColor as [number, number, number] },
    alternateRowStyles: { fillColor: [249, 250, 251] }, // gray-50
    margin: { top: 80 },
    didDrawPage: (data) => {
        // Footer (Page number)
        const str = `Page ${doc.getNumberOfPages()}`;
        doc.setFontSize(10);
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, data.settings.margin.left, pageHeight - 10);
    }
  });

  // --- Save the PDF ---
  const fileName = `fuelog_report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
