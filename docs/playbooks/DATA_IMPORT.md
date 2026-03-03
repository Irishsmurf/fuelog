# Playbook: Data Import

## Overview
The **Fuelog** import feature allows you to bulk upload historical fuel data from a spreadsheet or another application.

## 1. Preparing your Data
The importer expects a **Tab-Separated Value (TSV)** file. Most spreadsheet applications (Excel, Google Sheets) allow you to "Save As" or "Download" as `.tsv`.

### Required Columns (Headers)
Your file **must** include the following headers (case-insensitive) in the first row:

| Header | Description | Example |
| :--- | :--- | :--- |
| `Date` | The date of the fill-up (`DD/MM/YYYY` or `DD-MM-YYYY`). | `15/03/2024` |
| `Litres` | Amount of fuel added (number). | `42.50` |
| `Total Cost` | Total amount paid in Euro (number). | `68.20` |
| `Garage` | The filling station brand or name. | `Circle K` |
| `Distance since fueled` | Distance covered in **Kilometers** since the previous fill-up. | `520.4` |

### Column Order
The order of columns does not matter as long as the headers match exactly.

## 2. Execution Steps
1.  **Login:** Sign in to your Fuelog account.
2.  **Navigate:** Go to the **Import** page.
3.  **Select File:** Click "Choose File" and select your `.tsv` or `.txt` file.
4.  **Import:** Click **Process & Import Data**.
5.  **Monitor:**
    - **Reading/Parsing:** The app validates your file structure and data types.
    - **Importing:** Data is uploaded to Firestore in batches of 499 logs.
    - **Completion:** A success message will appear with the total count of imported logs.

## 3. Troubleshooting

### "Missing required header column"
- Ensure your file uses **Tabs** as delimiters, not commas.
- Double-check that all five required headers are present and spelled correctly.

### "Invalid Date"
- Ensure dates follow the `DD/MM/YYYY` or `DD-MM-YYYY` format.
- Leading zeros (e.g., `01/01/2024`) are recommended but not strictly required for days/months.

### "Invalid [Numeric Field]"
- Ensure there are no currency symbols (€), unit suffixes (Km, L), or thousands separators (commas in 1,000) in the numeric columns.
- Use a dot (`.`) as the decimal separator.

### Batch Limits
- If you have more than 5,000 logs, it is recommended to split the file into smaller chunks to avoid browser timeout or memory issues during parsing.
