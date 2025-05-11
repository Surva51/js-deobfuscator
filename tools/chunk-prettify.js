#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Transform } = require('stream');

// Configuration
const inputFile = process.argv[2] || path.join(__dirname, '../cli.js');
const outputFile = process.argv[3] || path.join(__dirname, '../prettified/cli-proper.js');

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Custom transformer that breaks code into manageable chunks
class CodeFormatter extends Transform {
  constructor(options) {
    super(options);
    this.buffer = '';
    this.indentLevel = 0;
    this.inString = false;
    this.stringChar = null;
  }

  _transform(chunk, encoding, callback) {
    // Add chunk to buffer
    this.buffer += chunk.toString();
    
    // Process buffer character by character
    let formattedChunk = '';
    
    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];
      const nextChar = this.buffer[i + 1] || '';
      
      // Handle string literals
      if ((char === '"' || char === "'" || char === '`') && 
          (i === 0 || this.buffer[i - 1] !== '\\')) {
        if (this.inString && char === this.stringChar) {
          this.inString = false;
          this.stringChar = null;
        } else if (!this.inString) {
          this.inString = true;
          this.stringChar = char;
        }
      }
      
      // Don't mess with formatting inside strings
      if (this.inString) {
        formattedChunk += char;
        continue;
      }
      
      // Format code
      switch (char) {
        case '{':
          this.indentLevel++;
          formattedChunk += char + '\n' + ' '.repeat(this.indentLevel * 2);
          break;
        case '}':
          this.indentLevel = Math.max(0, this.indentLevel - 1);
          formattedChunk += '\n' + ' '.repeat(this.indentLevel * 2) + char;
          if (nextChar !== ';' && nextChar !== ',') {
            formattedChunk += '\n' + ' '.repeat(this.indentLevel * 2);
          }
          break;
        case ';':
          formattedChunk += char;
          if (nextChar !== '}') {
            formattedChunk += '\n' + ' '.repeat(this.indentLevel * 2);
          }
          break;
        case ',':
          formattedChunk += char + ' ';
          break;
        case '=':
          // Special case for arrow functions and comparisons
          if (nextChar === '>') {
            formattedChunk += '=>';
            i++; // Skip the next character
          } else if (nextChar === '=' && this.buffer[i + 2] === '=') {
            formattedChunk += '===';
            i += 2; // Skip the next two characters
          } else if (nextChar === '=') {
            formattedChunk += '==';
            i++; // Skip the next character
          } else {
            formattedChunk += ' = ';
          }
          break;
        case '!':
          if (nextChar === '=') {
            if (this.buffer[i + 2] === '=') {
              formattedChunk += '!==';
              i += 2; // Skip the next two characters
            } else {
              formattedChunk += '!=';
              i++; // Skip the next character
            }
          } else {
            formattedChunk += char;
          }
          break;
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
          if (nextChar === char) {
            formattedChunk += char + char; // ++ or --
            i++; // Skip the next character
          } else if (nextChar === '=') {
            formattedChunk += char + '=';
            i++; // Skip the next character
          } else {
            formattedChunk += ' ' + char + ' ';
          }
          break;
        case '&':
          if (nextChar === '&') {
            formattedChunk += '&&';
            i++; // Skip the next character
          } else {
            formattedChunk += char;
          }
          break;
        case '|':
          if (nextChar === '|') {
            formattedChunk += '||';
            i++; // Skip the next character
          } else {
            formattedChunk += char;
          }
          break;
        default:
          formattedChunk += char;
      }
    }
    
    // Clear buffer and push formatted chunk
    this.buffer = '';
    this.push(formattedChunk);
    callback();
  }
  
  _flush(callback) {
    if (this.buffer) {
      this.push(this.buffer);
      this.buffer = '';
    }
    callback();
  }
}

console.log(`Processing file: ${inputFile}`);

// Create read and write streams
const readStream = fs.createReadStream(inputFile);
const writeStream = fs.createWriteStream(outputFile);
const formatter = new CodeFormatter();

// Pipe everything together
readStream.pipe(formatter).pipe(writeStream);

writeStream.on('finish', () => {
  console.log(`Successfully prettified code to: ${outputFile}`);
});

writeStream.on('error', (error) => {
  console.error('Error writing file:', error.message);
  process.exit(1);
});