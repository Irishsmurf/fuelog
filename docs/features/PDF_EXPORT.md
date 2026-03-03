# Feature Plan: PDF History Export

## Overview
Enable users to export their fuel history as a professional PDF report. This is useful for expense claims, tax purposes, or providing vehicle maintenance/resale records.

## User Requirements
- Export filtered fuel history to a PDF file.
- Professional layout including vehicle info (if available) and summary metrics.
- Support for multi-currency logs (showing both original and home currency).
- Mobile-friendly export trigger.

## Proposed Changes

### 1. New Dependencies
- **`jspdf`**: Core PDF generation library.
- **`jspdf-autotable`**: Plugin for easy table generation in PDFs.

### 2. UI Updates (`src/pages/HistoryPage.tsx`)
- Add a "Download PDF" button next to the "Copy Table Data" button.
- Add a loading state for the PDF generation process.

### 3. Logic Layer (`src/utils/pdfExport.ts`)
Create a new utility to handle PDF generation:
- **Header:** App Name (Fuelog), User Name/Email, Date Range, Export Date.
- **Summary:** Total distance, total fuel, average efficiency, total cost (Home Currency).
- **Table:** 
    - Columns: Date, Brand, Cost (Original/Home), Distance, Fuel, Efficiency (MPG).
    - Footer: Totals.
- **Metadata:** Page numbers, branding.

### 4. Testing Strategy

#### A. Unit Tests (`src/utils/pdfExport.test.ts`)
- Test the mapping of `Log` objects to table rows.
- Mock `jspdf` to verify that `doc.save()` or `doc.output()` is called with expected parameters.
- Verify calculation of summary metrics within the PDF context.

#### B. E2E Tests (`e2e/pdf_export.spec.ts`)
- Navigate to the History page.
- Ensure the "Download PDF" button is present and enabled (if logs exist).
- Trigger the download.
- Use Playwright's `page.waitForEvent('download')` to verify that a PDF file is actually generated and served.
- (Optional) Use a library like `pdf-parse` in the test suite to verify the text content of the generated PDF.

## Implementation Steps
1.  Install `jspdf` and `jspdf-autotable`.
2.  Implement `src/utils/pdfExport.ts`.
3.  Add the export button to `HistoryPage`.
4.  Write and run unit tests.
5.  Write and run E2E tests.

## Future Considerations
- Allow users to add their License Plate or Vehicle Name to the report header.
- Charts inclusion in the PDF (using `canvas` to image conversion).
