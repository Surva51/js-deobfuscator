#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, '../cli.js');
const outputFile = process.argv[3] || path.join(__dirname, '../prettified/cli-proper.js');

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function prettify() {
  try {
    console.log(`Reading file: ${inputFile}`);
    const code = fs.readFileSync(inputFile, 'utf8');
    
    console.log('Prettifying code with Prettier...');
    
    // Use Prettier to properly format the code
    const formattedCode = await prettier.format(code, {
      parser: 'babel',
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5',
      printWidth: 100,
      endOfLine: 'lf',
      // Enable more permissive parsing
      arrowParens: 'avoid',
      bracketSpacing: true,
    });
    
    console.log(`Writing prettified code to: ${outputFile}`);
    fs.writeFileSync(outputFile, formattedCode);
    
    console.log('Done!');
  } catch (error) {
    console.error('Error prettifying code:', error.message);
    
    // If Prettier fails, try a more basic approach with manual replacements
    if (error.message.includes('SyntaxError')) {
      console.log('Falling back to basic prettification...');
      
      const code = fs.readFileSync(inputFile, 'utf8');
      
      // Add line breaks after semicolons and curly braces
      let formattedCode = code
        .replace(/;/g, ';\n')
        .replace(/{/g, '{\n')
        .replace(/}/g, '}\n')
        .replace(/\)\s*{/g, ') {\n');
      
      console.log(`Writing basic prettified code to: ${outputFile}`);
      fs.writeFileSync(outputFile, formattedCode);
      
      console.log('Done with basic prettification!');
    } else {
      process.exit(1);
    }
  }
}

prettify().catch(console.error);