#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Directory containing the module files
const MODULES_DIR = path.join(__dirname, 'modules');

// Output file for the report
const OUTPUT_FILE = path.join(__dirname, 'analysis', 'import-analysis.md');

// Create analysis directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'analysis'))) {
  fs.mkdirSync(path.join(__dirname, 'analysis'));
}

// Regular expression to match import statements
const importRegex = /import\s*(?:{([^}]+)}|([a-zA-Z0-9_$]+))\s*from\s*["']([^"']+)["'];?/g;

// Object to store the imports count by module
const importsByModule = {};
// Object to store the files importing a particular module
const filesByImport = {};

// Process a single file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const imports = match[1] ? match[1].split(',').map(i => i.trim()) : [];
    const defaultImport = match[2];
    const module = match[3];

    // Add the module to the imports count
    if (!importsByModule[module]) {
      importsByModule[module] = 0;
    }
    importsByModule[module]++;

    // Add the file to the list of files importing this module
    if (!filesByImport[module]) {
      filesByImport[module] = new Set();
    }
    filesByImport[module].add(fileName);

    // Log information for debugging
    if (defaultImport) {
      console.log(`${fileName}: default import ${defaultImport} from ${module}`);
    }
    if (imports.length > 0) {
      console.log(`${fileName}: named imports ${imports.join(', ')} from ${module}`);
    }
  }
}

// Process all files in the modules directory
fs.readdirSync(MODULES_DIR)
  .filter(file => file.endsWith('.js') && !file.startsWith('_'))
  .forEach(file => {
    processFile(path.join(MODULES_DIR, file));
  });

// Generate the report
let report = `# Claude CLI Import Analysis\n\n`;

// Sort modules by import count
const sortedModules = Object.entries(importsByModule)
  .sort((a, b) => b[1] - a[1]);

// Add summary by module
report += `## Imports by Module\n\n`;
report += `| Module | Import Count | Files |\n`;
report += `| ------ | ------------ | ----- |\n`;

sortedModules.forEach(([module, count]) => {
  const files = Array.from(filesByImport[module] || []).join(', ');
  report += `| ${module} | ${count} | ${files} |\n`;
});

// Group modules by category
const categories = {
  'Core Node.js': ['node:module', 'node:path', 'node:fs', 'node:os', 'node:process', 'node:url', 
                   'node:events', 'node:stream', 'node:string_decoder', 'node:buffer', 'node:util',
                   'fs', 'path', 'os', 'process', 'url', 'events', 'stream', 'util', 'crypto', 
                   'child_process', 'http', 'https', 'tty', 'net', 'zlib', 'assert'],
  'Third-party': ['better-sqlite3'],
  'Other': []
};

// Categorize modules
report += `\n## Modules by Category\n\n`;

Object.entries(categories).forEach(([category, modules]) => {
  report += `### ${category}\n\n`;
  
  // Filter and sort modules in this category
  const categoryModules = sortedModules
    .filter(([module, _]) => {
      if (category === 'Other') {
        return !Object.values(categories)
          .flat()
          .filter(m => m !== 'Other')
          .includes(module);
      }
      return modules.some(m => module.includes(m));
    });
  
  if (categoryModules.length === 0) {
    report += `No modules in this category.\n\n`;
    return;
  }
  
  report += `| Module | Import Count |\n`;
  report += `| ------ | ------------ |\n`;
  
  categoryModules.forEach(([module, count]) => {
    report += `| ${module} | ${count} |\n`;
  });
  
  report += `\n`;
});

// Write the report to the output file
fs.writeFileSync(OUTPUT_FILE, report);
console.log(`Report written to ${OUTPUT_FILE}`);