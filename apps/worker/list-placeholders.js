const fs = require('fs');
const path = require('path');

// List of known placeholder files
const placeholderFiles = [
  'app/api/workflow/[id]/messages/route.ts',
  'app/api/workflow/[id]/participants/route.ts', 
  'app/api/workflow/[id]/status/route.ts',
  'app/api/auth/[...nextauth]/route.ts'
];

console.log('Placeholder Files Created During OpenNext.js Conversion:');
console.log('=====================================================\n');

placeholderFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`✓ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`✗ ${file} (missing)`);
  }
});

console.log('\nThese files need proper implementation.');
console.log('See PLACEHOLDER_FILES.md for details.'); 