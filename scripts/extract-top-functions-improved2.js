#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified/cli-pretty.js');
const outputDir = path.join(__dirname, 'extracted-functions');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// List of top functions to extract based on our previous analysis
// Each entry has name and expected size to help identify the correct instance
const topFunctions = [
  { name: '_B6', expectedSize: 224422 },
  { name: 'EH', expectedSize: 143941 },
  { name: 'Z', expectedSize: 110623 },
  { name: 'B0', expectedSize: 77221 },
  { name: 'qO4', expectedSize: 73307 },
  { name: 'p5', expectedSize: 53232 },
  { name: 'cE4', expectedSize: 50511 },
  { name: '$o', expectedSize: 42535 },
  { name: 'C8', expectedSize: 38274 },
  { name: 'ST4', expectedSize: 32319 }
];

// Read the file
console.log(`Reading file: ${inputFile}`);
const code = fs.readFileSync(inputFile, 'utf8');
console.log(`File size: ${(code.length / 1024 / 1024).toFixed(2)} MB`);

// Extract each function by pattern matching
for (const func of topFunctions) {
  console.log(`\nFinding function ${func.name} (expected size: ${func.expectedSize} chars)...`);
  
  // Escape special characters in function name for regex
  const escapedName = func.name.replace(/\$/g, '\\$');
  
  // Find all instances of this function
  const functionRegex = new RegExp(`function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const matches = [...code.matchAll(functionRegex)];
  
  console.log(`Found ${matches.length} instances of function ${func.name}`);
  
  if (matches.length === 0) {
    console.log(`Function ${func.name} not found in the file`);
    continue;
  }
  
  // Process each match
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startPos = match.index;
    
    // Find the opening brace of the function body
    let openingBracePos = startPos;
    while (openingBracePos < code.length && code[openingBracePos] !== '{') {
      openingBracePos++;
    }
    
    if (openingBracePos >= code.length) {
      console.log(`Could not find opening brace for function ${func.name} instance ${i+1}`);
      continue;
    }
    
    // Track braces to find the end of the function
    let braceCount = 1;
    let pos = openingBracePos + 1;
    
    while (pos < code.length && braceCount > 0) {
      if (code[pos] === '{') {
        braceCount++;
      } else if (code[pos] === '}') {
        braceCount--;
      }
      pos++;
    }
    
    if (braceCount !== 0) {
      console.log(`Could not find matching closing brace for function ${func.name} instance ${i+1}`);
      continue;
    }
    
    // Extract function code
    const functionCode = code.substring(startPos, pos);
    const sizeDiff = Math.abs(functionCode.length - func.expectedSize);
    const sizePercent = (sizeDiff / func.expectedSize) * 100;
    
    console.log(`Instance ${i+1} size: ${functionCode.length} chars (${sizePercent.toFixed(2)}% difference from expected)`);
    
    // Write to file if it's close to the expected size
    if (sizePercent < 100) { // Allow for some difference
      const outputFile = path.join(outputDir, `${func.name}${matches.length > 1 ? `_${i+1}` : ''}.js`);
      fs.writeFileSync(outputFile, functionCode);
      
      console.log(`Extracted function ${func.name} to ${outputFile} (${functionCode.length} chars)`);
      
      // Count lines and parameters
      const lines = functionCode.split('\n');
      console.log(`Line count: ${lines.length}`);
      
      const paramMatch = functionCode.match(/function\s+\w+\s*\(([^)]*)\)/);
      if (paramMatch) {
        const params = paramMatch[1].trim() ? paramMatch[1].split(',').length : 0;
        console.log(`Parameters: ${params}`);
      }
    }
  }
  
  // If no acceptable match was found, try a different approach
  // by searching for the entire file for the function with a size closest to expected
  if (!fs.existsSync(path.join(outputDir, `${func.name}.js`)) && 
      !fs.existsSync(path.join(outputDir, `${func.name}_1.js`))) {
    
    console.log(`No matching function found with expected size. Searching entire file for best match...`);
    
    // Use a more permissive regex to find all possible declarations
    const permissiveRegex = new RegExp(`(function\\s+${escapedName}\\s*\\([^)]*\\)|${escapedName}\\s*=\\s*function\\s*\\([^)]*\\)|const\\s+${escapedName}\\s*=\\s*function\\s*\\([^)]*\\))`, 'g');
    const allMatches = [...code.matchAll(permissiveRegex)];
    
    console.log(`Found ${allMatches.length} possible matches with permissive search`);
    
    let bestMatch = null;
    let bestSizeDiff = Infinity;
    
    for (let i = 0; i < allMatches.length; i++) {
      const match = allMatches[i];
      const startPos = match.index;
      
      // Find the opening brace
      let openingBracePos = startPos;
      while (openingBracePos < code.length && code[openingBracePos] !== '{') {
        openingBracePos++;
      }
      
      if (openingBracePos >= code.length) continue;
      
      // Track braces to find the end of the function
      let braceCount = 1;
      let pos = openingBracePos + 1;
      
      while (pos < code.length && braceCount > 0) {
        if (code[pos] === '{') {
          braceCount++;
        } else if (code[pos] === '}') {
          braceCount--;
        }
        pos++;
      }
      
      if (braceCount !== 0) continue;
      
      // Extract function code
      const functionCode = code.substring(startPos, pos);
      const sizeDiff = Math.abs(functionCode.length - func.expectedSize);
      
      if (sizeDiff < bestSizeDiff) {
        bestMatch = {
          startPos,
          endPos: pos,
          code: functionCode,
          sizeDiff,
          index: i
        };
        bestSizeDiff = sizeDiff;
      }
    }
    
    if (bestMatch) {
      const sizePercent = (bestMatch.sizeDiff / func.expectedSize) * 100;
      console.log(`Best match found: instance ${bestMatch.index + 1}, size difference: ${sizePercent.toFixed(2)}%`);
      
      const outputFile = path.join(outputDir, `${func.name}.js`);
      fs.writeFileSync(outputFile, bestMatch.code);
      
      console.log(`Extracted function ${func.name} to ${outputFile} (${bestMatch.code.length} chars)`);
      
      // Count lines and parameters
      const lines = bestMatch.code.split('\n');
      console.log(`Line count: ${lines.length}`);
      
      const paramMatch = bestMatch.code.match(/function\s+\w+\s*\(([^)]*)\)/);
      if (paramMatch) {
        const params = paramMatch[1].trim() ? paramMatch[1].split(',').length : 0;
        console.log(`Parameters: ${params}`);
      }
    } else {
      console.log(`Could not find suitable match for function ${func.name}`);
    }
  }
}

console.log('\nFunction extraction complete!');