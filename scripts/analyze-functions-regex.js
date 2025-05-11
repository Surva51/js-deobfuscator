#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified', 'cli-pretty.js');
const outputFile = path.join(__dirname, 'analysis', 'function-analysis.md');

// Ensure the output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Analyzing file: ${inputFile}`);

// Read the file content
const code = fs.readFileSync(inputFile, 'utf8');

// Regular expressions to match different function patterns
const functionPatterns = [
  // Function declarations: function name() {}
  { regex: /\bfunction\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g, type: 'Function Declaration' },
  
  // Arrow functions assigned to variables: var x = () => {}
  { regex: /\b(?:var|const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*\{/g, type: 'Arrow Function' },
  
  // Function expressions assigned to variables: var x = function() {}
  { regex: /\b(?:var|const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*function\s*\([^)]*\)\s*\{/g, type: 'Function Expression' },
  
  // Immediately-invoked function expressions (IIFE): var x = (function() {})()
  { regex: /\b(?:var|const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*\(\s*function\s*\([^)]*\)\s*\{/g, type: 'IIFE' },
  
  // Special obfuscated functions for Claude CLI: var A = (Z, G) => () => 
  { regex: /\b(?:var|const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*\((?:[a-zA-Z0-9_$]+(?:\s*,\s*[a-zA-Z0-9_$]+)*)\)\s*=>\s*\(\)/g, type: 'Special Function Pattern' }
];

// Function to extract all function definitions
function extractFunctions(code) {
  const functions = [];
  
  // Process each pattern
  functionPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.regex.exec(code)) !== null) {
      const name = match[1];
      const startIndex = match.index;
      
      // Find the end of this function by balancing braces
      let braceCount = 0;
      let foundOpeningBrace = false;
      let endIndex = startIndex;
      
      for (let i = startIndex; i < code.length; i++) {
        if (code[i] === '{') {
          foundOpeningBrace = true;
          braceCount++;
        } else if (code[i] === '}') {
          braceCount--;
          if (foundOpeningBrace && braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      // Calculate size and extract the function body
      const body = code.substring(startIndex, endIndex);
      const size = body.length;
      
      // Count parameters
      const paramMatch = body.match(/\(([^)]*)\)/);
      const params = paramMatch ? paramMatch[1].split(',').filter(p => p.trim()).length : 0;
      
      // Calculate line range
      const codeUpToStart = code.substring(0, startIndex);
      const startLine = (codeUpToStart.match(/\n/g) || []).length + 1;
      const codeUpToEnd = code.substring(0, endIndex);
      const endLine = (codeUpToEnd.match(/\n/g) || []).length + 1;
      
      functions.push({
        name,
        type: pattern.type,
        size,
        params,
        location: {
          start: startLine,
          end: endLine
        }
      });
    }
  });
  
  return functions;
}

// Extract all functions
console.log('Extracting functions...');
const functionData = extractFunctions(code);

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

// Get the top 100 largest functions for the report
const topFunctions = functionData.slice(0, 100);

// Generate the output report
console.log('Generating report...');
const functionRows = topFunctions.map((fn, index) => {
  return `| ${index + 1} | ${fn.name} | ${fn.type} | ${fn.size} | ${fn.params} | ${fn.location.start}-${fn.location.end} |`;
}).join('\n');

const report = `# Function Analysis

This report lists the top 100 largest functions in the code, sorted by size.

## Summary

- **Total Functions**: ${totalFunctions}
- **Total Size**: ${totalSize} characters
- **Average Size**: ${averageSize} characters

## Size Distribution

- **Small** (<500 chars): ${sizeDistribution.small} functions
- **Medium** (500-5,000 chars): ${sizeDistribution.medium} functions
- **Large** (5,000-50,000 chars): ${sizeDistribution.large} functions
- **Extra Large** (>50,000 chars): ${sizeDistribution.extraLarge} functions

## Top 100 Functions by Size

| # | Name | Type | Size (chars) | Params | Lines |
|---|------|------|-------------|--------|-------|
${functionRows}

## Next Steps

The largest functions listed above would be good candidates for focused deobfuscation efforts, as they likely contain significant functionality.
`;

// Save the report
fs.writeFileSync(outputFile, report);
console.log(`Report saved to: ${outputFile}`);