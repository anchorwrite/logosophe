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
      
      // Get the function body
      let braceCount = 1;
      let functionBodyEnd = functionBodyStart;
      for (let i = functionBodyStart; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        if (braceCount === 0) {
          functionBodyEnd = i;
          break;
        }
      }
      
      const functionBody = content.substring(functionBodyStart, functionBodyEnd);
      
      // Check if params destructuring already exists
      if (!functionBody.includes('const {') || !functionBody.includes('} = await params')) {
        // Find the first try block or first statement
        const firstTryMatch = functionBody.match(/^\s*try\s*\{/m);
        const firstStatementMatch = functionBody.match(/^\s*(\w+)/m);
        
        let insertPosition = 0;
        if (firstTryMatch) {
          insertPosition = firstTryMatch.index + firstTryMatch[0].length;
        } else if (firstStatementMatch) {
          insertPosition = firstStatementMatch.index;
        }
        
        const paramsDestructuring = '\n    const { id } = await params;\n';
        const newFunctionBody = functionBody.substring(0, insertPosition) + paramsDestructuring + functionBody.substring(insertPosition);
        
        content = content.substring(0, functionBodyStart) + newFunctionBody + content.substring(functionBodyEnd);
        modified = true;
        console.log(`  Added params destructuring to ${path.basename(filePath)}`);
      }
    }
    
    // Replace all instances of params.id with id
    const paramsIdPattern = /params\.id/g;
    if (paramsIdPattern.test(content)) {
      content = content.replace(paramsIdPattern, 'id');
      modified = true;
      console.log(`  Replaced params.id with id in ${path.basename(filePath)}`);
    }
    
    // Also handle params.email for email-based routes
    const paramsEmailPattern = /params\.email/g;
    if (paramsEmailPattern.test(content)) {
      content = content.replace(paramsEmailPattern, 'email');
      modified = true;
      console.log(`  Replaced params.email with email in ${path.basename(filePath)}`);
    }
    
    // Handle params.token for token-based routes
    const paramsTokenPattern = /params\.token/g;
    if (paramsTokenPattern.test(content)) {
      content = content.replace(paramsTokenPattern, 'token');
      modified = true;
      console.log(`  Replaced params.token with token in ${path.basename(filePath)}`);
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