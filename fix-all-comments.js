const fs = require('fs');
const path = require('path');

function fixCommentsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let fixed = content;
  
  // Fix standalone malformed comments: / comment -> // comment
  fixed = fixed.replace(/^(\s*)\/ (.*)$/gm, '$1// $2');
  
  // Fix inline malformed comments: , / comment -> , // comment
  fixed = fixed.replace(/,(\s*)\/ (.*?)(?=\n|$)/g, ',$1// $2');
  
  // Fix inline malformed comments: = / comment -> = // comment
  fixed = fixed.replace(/=(\s*)\/ (.*?)(?=\n|$)/g, '=$1// $2');
  
  // Fix inline malformed comments: : / comment -> : // comment
  fixed = fixed.replace(/:(\s*)\/ (.*?)(?=\n|$)/g, ':$1// $2');
  
  // Fix inline malformed comments: ) / comment -> ) // comment
  fixed = fixed.replace(/\)(\s*)\/ (.*?)(?=\n|$)/g, ')$1// $2');
  
  // Fix inline malformed comments: } / comment -> } // comment
  fixed = fixed.replace(/\}(\s*)\/ (.*?)(?=\n|$)/g, '}$1// $2');
  
  // Fix inline malformed comments: ] / comment -> ] // comment
  fixed = fixed.replace(/\](\s*)\/ (.*?)(?=\n|$)/g, ']$1// $2');
  
  if (fixed !== content) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`Fixed comments in: ${filePath}`);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      if (entry !== 'node_modules' && !entry.startsWith('.')) {
        walk(fullPath);
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      fixCommentsInFile(fullPath);
    }
  }
}

// Start from the current directory or specify your source directory
walk(process.argv[2] || '.');

console.log('All malformed comment patterns fixed!'); 