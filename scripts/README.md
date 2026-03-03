# Fuelog Utility Scripts

This directory contains utility scripts for development and testing.

## mock-data-generator.js
Generates random fuel log data in TSV format for testing the **Import** feature.

### Usage
Run the script using Node.js and redirect the output to a file:
```bash
node scripts/mock-data-generator.js > mock_logs.tsv
```
Then, you can open `mock_logs.tsv` in a text editor, copy its content, and paste it into the **Import** page of the Fuelog app.

### Configuration
You can edit the `numEntries`, `brands`, and date range variables directly at the top of the script to customize the generated data.
