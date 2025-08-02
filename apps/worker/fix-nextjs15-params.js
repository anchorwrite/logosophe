const fs = require('fs');
const path = require('path');

function fixNextJs15Params(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Pattern to match API route functions with params
    const functionPattern = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\(\s*[^)]*,\s*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<[^>]+>\s*\}\s*\)\s*\{/g;
    
    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      const functionStart = match.index;
      const functionBodyStart = content.indexOf('{', functionStart) + 1;
      
      // Find the first line after the function declaration
      const firstLineMatch = content.substring(functionBodyStart).match(/^\s*(\w+)/m);
      if (firstLineMatch) {
        const firstStatement = firstLineMatch[1];
        
        // If the first statement is not already a params destructuring, add it
        if (!firstStatement.includes('const {') || !firstStatement.includes('} = await params')) {
          const insertPosition = functionBodyStart;
          const paramsDestructuring = '\n    const { id } = await params;\n';
          
          content = content.substring(0, insertPosition) + paramsDestructuring + content.substring(insertPosition);
          modified = true;
          console.log(`  Added params destructuring to ${path.basename(filePath)}`);
        }
      }
    }
    
    // Replace all instances of params.id with id
    const paramsIdPattern = /params\.id/g;
    if (paramsIdPattern.test(content)) {
      content = content.replace(paramsIdPattern, 'id');
      modified = true;
      console.log(`  Replaced params.id with id in ${path.basename(filePath)}`);
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function scanAndFixFiles() {
  const appDir = path.join(__dirname, 'app');
  let fixedCount = 0;
  
  function processDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (item.endsWith('.ts') && item.includes('route.ts')) {
        if (fixNextJs15Params(fullPath)) {
          fixedCount++;
        }
      }
    }
  }
  
  console.log('Scanning for Next.js 15 params issues...');
  processDirectory(appDir);
  
  if (fixedCount > 0) {
    console.log(`\nFixed ${fixedCount} files with Next.js 15 params issues.`);
  } else {
    console.log('\nNo Next.js 15 params issues found.');
  }
}

scanAndFixFiles(); 