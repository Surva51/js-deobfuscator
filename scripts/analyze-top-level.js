#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified', 'cli-pretty-fixed.js');
const outputFile = path.join(__dirname, 'analysis', 'top-level-functions.md');

// Ensure the output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Analyzing file: ${inputFile}`);

// Read the file content
const code = fs.readFileSync(inputFile, 'utf8');

// Parse the file with Babel
console.log('Parsing code...');
let ast;
try {
  ast = parser.parse(code, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'typescript',
      'classProperties',
      'objectRestSpread',
      'optionalChaining',
      'nullishCoalescingOperator',
      'dynamicImport'
    ],
    errorRecovery: true,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    allowSuperOutsideMethod: true,
    tolerant: true
  });
} catch (error) {
  console.error('Error parsing code:', error);
  // Instead of exiting, try parsing the code in chunks
  console.log('Attempting to parse the file in chunks...');
  process.exit(1);
}

// Create a function to measure code size
function getCodeSize(node) {
  try {
    const generated = generate(node, { compact: true });
    return generated.code.length;
  } catch (error) {
    return 0;
  }
}

// Structure to hold function data
const functionData = [];

// Identify top-level function declarations and expressions
console.log('Analyzing AST for top-level functions...');
traverse(ast, {
  // Function declarations at program level
  FunctionDeclaration(path) {
    if (path.parent.type === 'Program') {
      const name = path.node.id?.name || '<anonymous>';
      const size = getCodeSize(path.node);
      functionData.push({
        name,
        type: 'FunctionDeclaration',
        size,
        params: path.node.params.length,
        location: {
          start: path.node.loc.start.line,
          end: path.node.loc.end.line,
        }
      });
    }
  },
  
  // Variable declarations that are functions
  VariableDeclarator(path) {
    if (path.parent.parent.type === 'Program') {
      const init = path.node.init;
      if (
        init && 
        (init.type === 'FunctionExpression' || 
         init.type === 'ArrowFunctionExpression')
      ) {
        const name = path.node.id?.name || '<anonymous>';
        const size = getCodeSize(init);
        functionData.push({
          name,
          type: init.type,
          size,
          params: init.params.length,
          location: {
            start: init.loc.start.line,
            end: init.loc.end.line,
          }
        });
      }
    }
  },
  
  // Object methods at program level
  ObjectMethod(path) {
    if (path.findParent(p => p.isProgram())) {
      if (!path.parent || !path.parent.parent || path.parent.parent.type !== 'Program') {
        return;
      }
      
      const name = path.node.key?.name || '<anonymous method>';
      const size = getCodeSize(path.node);
      functionData.push({
        name,
        type: 'ObjectMethod',
        size,
        params: path.node.params.length,
        location: {
          start: path.node.loc.start.line,
          end: path.node.loc.end.line,
        }
      });
    }
  }
});

// Sort functions by size (descending)
functionData.sort((a, b) => b.size - a.size);

// Generate summary statistics
const totalFunctions = functionData.length;
const totalSize = functionData.reduce((acc, fn) => acc + fn.size, 0);
const averageSize = totalFunctions > 0 ? Math.round(totalSize / totalFunctions) : 0;

// Calculate size distribution
const sizeDistribution = {
  small: functionData.filter(fn => fn.size < 500).length,
  medium: functionData.filter(fn => fn.size >= 500 && fn.size < 5000).length,
  large: functionData.filter(fn => fn.size >= 5000 && fn.size < 50000).length,
  extraLarge: functionData.filter(fn => fn.size >= 50000).length
};

// Generate the output report
console.log('Generating report...');
const functionRows = functionData.map((fn, index) => {
  return `| ${index + 1} | ${fn.name} | ${fn.type} | ${fn.size} | ${fn.params} | ${fn.location.start}-${fn.location.end} |`;
}).join('\n');

const report = `# Top-Level Functions Analysis

This report lists all top-level functions in the code, sorted by size.

## Summary

- **Total Functions**: ${totalFunctions}
- **Total Size**: ${totalSize} characters
- **Average Size**: ${averageSize} characters

## Size Distribution

- **Small** (<500 chars): ${sizeDistribution.small} functions
- **Medium** (500-5,000 chars): ${sizeDistribution.medium} functions
- **Large** (5,000-50,000 chars): ${sizeDistribution.large} functions
- **Extra Large** (>50,000 chars): ${sizeDistribution.extraLarge} functions

## Function List

| # | Name | Type | Size (chars) | Params | Lines |
|---|------|------|-------------|--------|-------|
${functionRows}

## Next Steps

The largest functions listed above would be good candidates for focused deobfuscation efforts, as they likely contain significant functionality.
`;

// Save the report
fs.writeFileSync(outputFile, report);
console.log(`Report saved to: ${outputFile}`);