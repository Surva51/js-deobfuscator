const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// Check if required packages are installed
try {
  require('@babel/parser');
  require('@babel/traverse');
  require('@babel/generator');
  require('@babel/types');
} catch (e) {
  console.error('Missing required packages. Run: npm install @babel/parser @babel/traverse @babel/generator @babel/types');
  process.exit(1);
}

const inputFile = process.argv[2] || path.join(__dirname, '../prettified/cli-pretty.js');
const outputDir = process.argv[3] || path.join(__dirname, '../modules');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function splitByFunctionPattern() {
  console.log(`Reading file: ${inputFile}`);

  // Simple pattern detection to split file into modules
  // This doesn't rely on full AST parsing which can run out of memory

  // Read file in chunks
  const fileContent = fs.readFileSync(inputFile, 'utf8');

  console.log('Splitting file by function patterns...');

  // Extract all import statements - handle different import patterns
  const importRegex = /import\s*(?:(?:{[^}]+})|(?:[a-zA-Z0-9_$]+))\s*from\s*["'][^"']+["'];?/g;
  const imports = [];
  let match;

  while ((match = importRegex.exec(fileContent)) !== null) {
    imports.push(match[0]);
  }

  // Also look for default imports
  const defaultImportRegex = /import\s+([a-zA-Z0-9_$]+)\s+from\s*["'][^"']+["'];?/g;
  while ((match = defaultImportRegex.exec(fileContent)) !== null) {
    if (!imports.includes(match[0])) {
      imports.push(match[0]);
    }
  }

  // Detect function or variable declarations with large function bodies
  const variableDeclarationRegex = /(var|const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function\s*\([^)]*\)|A\([^)]*\)|F1\([^)]*\)|[\(\)a-zA-Z0-9_$]+\s*=>\s*)/g;
  const functionDeclarationRegex = /function\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*{/g;

  const potentialModules = [];

  // Find all potential function declarations
  while ((match = variableDeclarationRegex.exec(fileContent)) !== null) {
    const varName = match[2];
    const startPos = match.index;

    // Skip small variable names as they're likely not significant modules
    if (varName.length < 2) continue;

    // Find the closing brace for this function
    // This is a simplified approach that might not work for all cases
    let depth = 0;
    let endPos = startPos;
    let found = false;

    // Search forward from the match position to find the closing brace
    for (let i = startPos; i < fileContent.length; i++) {
      if (fileContent[i] === '{') depth++;
      else if (fileContent[i] === '}') {
        depth--;
        if (depth === 0) {
          // Found potential closing brace
          endPos = i + 1;
          found = true;
          break;
        }
      }
    }

    if (found) {
      const code = fileContent.substring(startPos, endPos);

      // Only consider as a module if it's large enough
      if (code.length > 500) {
        potentialModules.push({
          name: varName,
          code: code,
          startPos: startPos,
          endPos: endPos
        });
      }
    }
  }

  // Find all function declarations
  while ((match = functionDeclarationRegex.exec(fileContent)) !== null) {
    const funcName = match[1];
    const startPos = match.index;

    // Skip small function names as they're likely not significant modules
    if (funcName.length < 2) continue;

    // Find the closing brace for this function
    let depth = 0;
    let endPos = startPos;
    let found = false;

    // Scan forward to find the opening brace first
    for (let i = startPos; i < fileContent.length; i++) {
      if (fileContent[i] === '{') {
        depth = 1;
        // Then keep scanning to find the matching closing brace
        for (let j = i + 1; j < fileContent.length; j++) {
          if (fileContent[j] === '{') depth++;
          else if (fileContent[j] === '}') {
            depth--;
            if (depth === 0) {
              // Found the closing brace
              endPos = j + 1;
              found = true;
              break;
            }
          }
        }
        break;
      }
    }

    if (found) {
      const code = fileContent.substring(startPos, endPos);

      // Only consider as a module if it's large enough
      if (code.length > 500) {
        potentialModules.push({
          name: funcName,
          code: code,
          startPos: startPos,
          endPos: endPos
        });
      }
    }
  }

  console.log(`Found ${potentialModules.length} potential modules`);

  // Sort by size for easier analysis
  potentialModules.sort((a, b) => (b.endPos - b.startPos) - (a.endPos - a.startPos));

  // Filter out overlapping modules (keeping the larger ones)
  const filteredModules = [];
  for (const module of potentialModules) {
    // Check if this module overlaps with any already selected module
    const overlaps = filteredModules.some(existing =>
      (module.startPos >= existing.startPos && module.startPos <= existing.endPos) ||
      (module.endPos >= existing.startPos && module.endPos <= existing.endPos)
    );

    if (!overlaps) {
      filteredModules.push(module);
    }
  }

  console.log(`After filtering overlaps: ${filteredModules.length} modules`);

  // Limit to top 30 modules to avoid overwhelming
  const modules = filteredModules.slice(0, 30);

  // Create summary file
  let summary = '// Module summary\n';
  summary += '// This file helps to understand the module structure\n\n';

  // Write all imports
  summary += '// Original imports\n';
  summary += imports.join('\n') + '\n\n';

  // Export info on extracted modules
  summary += '// Extracted modules\n';

  // Write each module to a separate file
  modules.forEach((module, index) => {
    const fileName = `${module.name}.js`;
    const filePath = path.join(outputDir, fileName);

    // Add imports at the top of each module file
    let moduleCode = '// Extracted from cli.js\n';
    moduleCode += imports.join('\n') + '\n\n';
    moduleCode += module.code + '\n';
    moduleCode += '\n// Add export\n';
    moduleCode += `module.exports = ${module.name};\n`;

    fs.writeFileSync(filePath, moduleCode);

    const sizeKb = (module.code.length / 1024).toFixed(2);
    console.log(`Wrote module: ${fileName} (${sizeKb} KB)`);

    summary += `// ${index + 1}. ${module.name} - ${sizeKb} KB\n`;
    summary += `//    in file: ${fileName}\n`;
  });

  // Create a simplified main file that imports all modules
  let mainFile = '// Main entry point\n';
  mainFile += imports.join('\n') + '\n\n';
  mainFile += '// Import extracted modules\n';

  modules.forEach(module => {
    mainFile += `const ${module.name} = require('./${module.name}');\n`;
  });

  mainFile += '\n// Note: This is a simplified main file. The original code is in cli.js\n';

  const mainFilePath = path.join(outputDir, 'main.js');
  fs.writeFileSync(mainFilePath, mainFile);
  console.log(`Wrote main file: main.js`);

  // Write summary
  summary += '\n// Main file imports all extracted modules\n';
  const summaryPath = path.join(outputDir, '_summary.js');
  fs.writeFileSync(summaryPath, summary);
  console.log(`Wrote summary: _summary.js`);

  console.log('Done splitting modules!');
}

// Main module splitting function that chooses the appropriate method
function splitModules() {
  try {
    // For large files, use the pattern-based approach
    splitByFunctionPattern();
  } catch (error) {
    console.error('Error during module splitting:', error.message);
    process.exit(1);
  }
}

splitModules();