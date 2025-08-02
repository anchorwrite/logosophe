const fs = require('fs');
const path = require('path');

function fixParams(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace params.id with id
    if (content.includes('params.id')) {
      content = content.replace(/params\.id/g, 'id');
      modified = true;
      console.log(`  Replaced params.id with id in ${path.basename(filePath)}`);
    }
    
    // Replace params.email with email
    if (content.includes('params.email')) {
      content = content.replace(/params\.email/g, 'email');
      modified = true;
      console.log(`  Replaced params.email with email in ${path.basename(filePath)}`);
    }
    
    // Replace params.token with token
    if (content.includes('params.token')) {
      content = content.replace(/params\.token/g, 'token');
      modified = true;
      console.log(`  Replaced params.token with token in ${path.basename(filePath)}`);
    }
    
    // Add params destructuring if it doesn't exist
    if (!content.includes('const {') || !content.includes('} = await params')) {
      // Find function declarations and add destructuring
      const functionPattern = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\(\s*[^)]*,\s*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<[^>]+>\s*\}\s*\)\s*\{/g;
      
      let match;
      while ((match = functionPattern.exec(content)) !== null) {
        const functionStart = match.index;
        const functionBodyStart = content.indexOf('{', functionStart) + 1;
        
        // Find the first try block or first statement
        const functionBody = content.substring(functionBodyStart);
        const firstTryMatch = functionBody.match(/^\s*try\s*\{/m);
        const firstStatementMatch = functionBody.match(/^\s*(\w+)/m);
        
        let insertPosition = 0;
        if (firstTryMatch) {
          insertPosition = firstTryMatch.index + firstTryMatch[0].length;
        } else if (firstStatementMatch) {
          insertPosition = firstStatementMatch.index;
        }
        
        // Determine what to destructure based on the params type
        let destructuring = '';
        if (match[0].includes('email')) {
          destructuring = '\n    const { email } = await params;\n';
        } else if (match[0].includes('token')) {
          destructuring = '\n    const { token } = await params;\n';
        } else {
          destructuring = '\n    const { id } = await params;\n';
        }
        
        const newFunctionBody = functionBody.substring(0, insertPosition) + destructuring + functionBody.substring(insertPosition);
        content = content.substring(0, functionBodyStart) + newFunctionBody + content.substring(functionBodyStart + functionBody.length);
        modified = true;
        console.log(`  Added params destructuring to ${path.basename(filePath)}`);
      }
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
        if (fixParams(fullPath)) {
          fixedCount++;
        }
      }
    }
  }
  
  console.log('Scanning for params issues...');
  processDirectory(appDir);
  
  if (fixedCount > 0) {
    console.log(`\nFixed ${fixedCount} files with params issues.`);
  } else {
    console.log('\nNo params issues found.');
  }
}

scanAndFixFiles(); 