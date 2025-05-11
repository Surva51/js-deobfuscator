# JavaScript Deobfuscator

A toolkit for analyzing and deobfuscating JavaScript code. This project provides tools to help understand obfuscated JavaScript by extracting components, identifying patterns, and converting code to more readable formats.

## Features

- **Code Prettification**: Format minified and obfuscated JavaScript for better readability
- **Function Extraction**: Extract and analyze functions from obfuscated code
- **Module Splitting**: Break down obfuscated code into separate modules
- **Library Identification**: Detect and separate third-party libraries
- **Variable Renaming**: Rename obfuscated variables for better understanding
- **Analysis Tools**: Analyze code structure, imports, and business logic flow

## Project Structure

The project is organized into several directories for different aspects of the deobfuscation process:
- `analysis/`: Analysis reports and summaries
- `cleanup/`: Tools for cleaning up extracted code
- `core-functions/`: Core functions extracted from obfuscated code
- `extracted-components/`: Organized extracted components
- `extracted-functions/`: Raw extracted functions
- `modules/`: Split modules
- `scripts/`: Analysis and extraction scripts
- `tools/`: Utility tools (prettifiers, splitters, etc.)

## Usage

Run the full deobfuscation pipeline:
```bash
./deobfuscate-steps.sh
```

Or run individual steps:
```bash
node deobfuscate.js
node scripts/extract-key-functions.js
node scripts/analyze-imports.js
```

## License

This project is open-source under the MIT License.
