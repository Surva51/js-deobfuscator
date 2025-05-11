#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified', 'cli-pretty.js');
const outputDir = path.join(__dirname, 'extracted-functions');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Analyzing file: ${inputFile}`);

// Read the file content
const code = fs.readFileSync(inputFile, 'utf8');

// List of functions to extract (from our previous analysis)
const functionsToExtract = [
  { name: '_B6', startLine: 58703, endLine: 60279 },
  { name: 'EH', startLine: 16353, endLine: 17788 },
  { name: 'Z', startLine: 13216, endLine: 14592 },
  { name: 'B0', startLine: 39556, endLine: 40519 },
  { name: 'qO4', startLine: 7716, endLine: 7718 }
];

// Extract a function by finding its definition
function extractFunctionDefinition(code, functionName, startLine, endLine) {
  const lines = code.split('\n');
  
  // Build a regex to find the function definition
  const functionRegex = new RegExp(`\\bfunction\\s+${functionName}\\s*\\(`, 'g');
  
  // Find the function start
  let startIndex = 0;
  let lineCounter = 1;
  let foundStart = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lineCounter >= startLine - 10 && lineCounter <= startLine + 10) {
      // Look for the function definition around the expected line
      if (functionRegex.test(lines[i])) {
        startIndex = i;
        foundStart = true;
        break;
      }
    }
    lineCounter++;
  }
  
  if (!foundStart) {
    console.error(`Could not find function ${functionName} around line ${startLine}`);
    return null;
  }
  
  // Find the function end by tracking braces
  let braceCount = 0;
  let foundOpeningBrace = false;
  let endIndex = startIndex;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '{') {
        foundOpeningBrace = true;
        braceCount++;
      } else if (line[j] === '}') {
        braceCount--;
        if (foundOpeningBrace && braceCount === 0) {
          endIndex = i;
          break;
        }
      }
    }
    
    if (endIndex !== startIndex) break;
  }
  
  // Extract the function
  return lines.slice(startIndex, endIndex + 1).join('\n');
}

// Process each function in the list
for (const func of functionsToExtract) {
  console.log(`Extracting function: ${func.name}`);
  
  const functionCode = extractFunctionDefinition(code, func.name, func.startLine, func.endLine);
  
  if (functionCode) {
    const outputFile = path.join(outputDir, `${func.name}.js`);
    fs.writeFileSync(outputFile, functionCode);
    console.log(`Saved function ${func.name} to ${outputFile}`);
  }
}

console.log('Function extraction complete!');