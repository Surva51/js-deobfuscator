#!/usr/bin/env node

/**
 * This script extracts identified library and business logic functions
 * into separate files based on the analysis from lib-identifier.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, 'prettified/cli-pretty.js');
const analysisFile = path.join(__dirname, 'identified-libs/extraction-map.json');
const outputDir = path.join(__dirname, 'extracted-components');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create subdirectories
const libDir = path.join(outputDir, 'libraries');
const businessDir = path.join(outputDir, 'business-logic');
const mixedDir = path.join(outputDir, 'mixed');

if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
if (!fs.existsSync(businessDir)) fs.mkdirSync(businessDir, { recursive: true });
if (!fs.existsSync(mixedDir)) fs.mkdirSync(mixedDir, { recursive: true });

// Read the prettified code
console.log(`Reading file: ${inputFile}`);
const code = fs.readFileSync(inputFile, 'utf8');
console.log(`File size: ${(code.length / 1024 / 1024).toFixed(2)} MB`);

// Read the analysis results
console.log(`Reading analysis from: ${analysisFile}`);
let extractionMap;
try {
  extractionMap = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
} catch (err) {
  console.error(`Error reading analysis file: ${err.message}`);
  console.log('Please run lib-identifier.js first to generate the analysis.');
  process.exit(1);
}

// Extract a function from the code
function extractFunction(code, funcName) {
  const funcRegex = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const match = funcRegex.exec(code);
  
  if (!match) {
    console.warn(`Function ${funcName} not found in code`);
    return null;
  }
  
  const startPos = match.index;
  
  // Find the end of the function by tracking braces
  let braceCount = 1;
  let endPos = startPos + match[0].length;
  
  while (braceCount > 0 && endPos < code.length) {
    if (code[endPos] === '{') braceCount++;
    else if (code[endPos] === '}') braceCount--;
    endPos++;
  }
  
  return {
    code: code.substring(startPos, endPos),
    start: startPos,
    end: endPos
  };
}

// Extract all functions for a specific category
function extractFunctions(code, funcNames, outputDir, category) {
  const extracted = {};
  
  funcNames.forEach(funcName => {
    console.log(`Extracting ${category} function: ${funcName}`);
    const result = extractFunction(code, funcName);
    
    if (result) {
      const outputFile = path.join(outputDir, `${funcName}.js`);
      fs.writeFileSync(outputFile, result.code);
      extracted[funcName] = {
        file: outputFile,
        size: result.code.length
      };
    }
  });
  
  return extracted;
}

// Extract library functions
function extractLibraryFunctions(code, extractionMap) {
  const libraries = {};
  
  for (const [libName, funcNames] of Object.entries(extractionMap.libraries)) {
    console.log(`\nExtracting ${libName} library functions...`);
    const libOutputDir = path.join(libDir, libName);
    if (!fs.existsSync(libOutputDir)) fs.mkdirSync(libOutputDir, { recursive: true });
    
    const extractedFuncs = extractFunctions(code, funcNames, libOutputDir, 'library');
    libraries[libName] = extractedFuncs;
    
    // Write a summary for this library
    const summaryFile = path.join(libOutputDir, '_summary.md');
    let summary = `# ${libName} Library\n\n`;
    summary += `This directory contains functions identified as part of the ${libName} library.\n\n`;
    summary += '## Functions\n\n';
    
    Object.entries(extractedFuncs)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([funcName, info]) => {
        summary += `- **${funcName}** (${info.size.toLocaleString()} bytes)\n`;
      });
    
    fs.writeFileSync(summaryFile, summary);
  }
  
  return libraries;
}

// Extract business logic functions
function extractBusinessFunctions(code, extractionMap) {
  const features = {};
  
  for (const [featureName, funcNames] of Object.entries(extractionMap.businessLogic)) {
    console.log(`\nExtracting ${featureName} business logic functions...`);
    const featureOutputDir = path.join(businessDir, featureName);
    if (!fs.existsSync(featureOutputDir)) fs.mkdirSync(featureOutputDir, { recursive: true });
    
    const extractedFuncs = extractFunctions(code, funcNames, featureOutputDir, 'business');
    features[featureName] = extractedFuncs;
    
    // Write a summary for this feature
    const summaryFile = path.join(featureOutputDir, '_summary.md');
    let summary = `# ${featureName} Feature\n\n`;
    summary += `This directory contains business logic functions related to ${featureName}.\n\n`;
    summary += '## Functions\n\n';
    
    Object.entries(extractedFuncs)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([funcName, info]) => {
        summary += `- **${funcName}** (${info.size.toLocaleString()} bytes)\n`;
      });
    
    fs.writeFileSync(summaryFile, summary);
  }
  
  return features;
}

// Extract mixed functions (containing both library and business logic)
function extractMixedFunctions(code, extractionMap) {
  const mixedFuncs = {};
  
  console.log('\nExtracting mixed functions...');
  for (const [funcName, info] of Object.entries(extractionMap.mixed)) {
    console.log(`Extracting mixed function: ${funcName}`);
    const result = extractFunction(code, funcName);
    
    if (result) {
      const outputFile = path.join(mixedDir, `${funcName}.js`);
      fs.writeFileSync(outputFile, result.code);
      
      // Create a metadata file with information about this mixed function
      const metaFile = path.join(mixedDir, `${funcName}.meta.json`);
      fs.writeFileSync(metaFile, JSON.stringify({
        name: funcName,
        size: result.code.length,
        libraries: info.libraries,
        businessFeatures: info.businessFeatures
      }, null, 2));
      
      mixedFuncs[funcName] = {
        file: outputFile,
        metaFile: metaFile,
        size: result.code.length,
        ...info
      };
    }
  }
  
  // Write a summary for mixed functions
  const summaryFile = path.join(mixedDir, '_summary.md');
  let summary = `# Mixed Functions\n\n`;
  summary += `This directory contains functions that contain both library code and business logic.\n\n`;
  summary += '## Functions\n\n';
  
  Object.entries(mixedFuncs)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([funcName, info]) => {
      summary += `### ${funcName} (${info.size.toLocaleString()} bytes)\n\n`;
      summary += `- **Libraries**: ${info.libraries.join(', ')}\n`;
      summary += `- **Business Features**: ${info.businessFeatures.join(', ')}\n\n`;
    });
  
  fs.writeFileSync(summaryFile, summary);
  
  return mixedFuncs;
}

// Main function to extract all components
function extractAllComponents(code, extractionMap) {
  // Extract library functions
  const libraries = extractLibraryFunctions(code, extractionMap);
  
  // Extract business logic functions
  const features = extractBusinessFunctions(code, extractionMap);
  
  // Extract mixed functions
  const mixedFuncs = extractMixedFunctions(code, extractionMap);
  
  // Generate a master summary
  const summaryFile = path.join(outputDir, 'extraction-summary.md');
  let summary = `# Extraction Summary\n\n`;
  
  // Library summary
  summary += `## Libraries\n\n`;
  for (const [libName, funcs] of Object.entries(libraries)) {
    const count = Object.keys(funcs).length;
    const totalSize = Object.values(funcs).reduce((sum, info) => sum + info.size, 0);
    summary += `- **${libName}**: ${count} functions, ${totalSize.toLocaleString()} bytes total\n`;
  }
  
  // Business logic summary
  summary += `\n## Business Logic Features\n\n`;
  for (const [featureName, funcs] of Object.entries(features)) {
    const count = Object.keys(funcs).length;
    const totalSize = Object.values(funcs).reduce((sum, info) => sum + info.size, 0);
    summary += `- **${featureName}**: ${count} functions, ${totalSize.toLocaleString()} bytes total\n`;
  }
  
  // Mixed functions summary
  summary += `\n## Mixed Functions\n\n`;
  summary += `- **Total**: ${Object.keys(mixedFuncs).length} functions\n`;
  summary += `- **Total Size**: ${Object.values(mixedFuncs).reduce((sum, info) => sum + info.size, 0).toLocaleString()} bytes\n`;
  
  // Write the summary
  fs.writeFileSync(summaryFile, summary);
  console.log(`\nSummary written to ${summaryFile}`);
}

// Run the extraction
extractAllComponents(code, extractionMap);