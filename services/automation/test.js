/**
 * Test script for Xiimalab Automation Service
 *
 * This script verifies that all components are working correctly.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Xiimalab Automation Service...\n');

// Test 1: Check if required dependencies are installed
console.log('1. Checking dependencies...');
try {
  const pkg = require('./package.json');
  const deps = Object.keys(pkg.dependencies);
  console.log(`   Found ${deps.length} dependencies: ${deps.join(', ')}`);
  console.log('   ✅ Dependencies check passed\n');
} catch (error) {
  console.error('   ❌ Dependencies check failed:', error.message);
  process.exit(1);
}

// Test 2: Check configuration file
console.log('2. Checking configuration...');
try {
  const config = require('./config');
  console.log('   ✅ Configuration file loaded successfully');
  console.log(`   Dashboard URL: ${config.dashboard.url}`);
  console.log(`   Output directory: ${config.output.directory}`);
  console.log(`   RedimensionAI URL: ${config.redimensionAI.url}`);
  console.log(`   Export formats: ${config.redimensionAI.formats.length}\n`);
} catch (error) {
  console.error('   ❌ Configuration check failed:', error.message);
  process.exit(1);
}

// Test 3: Check if required directories exist
console.log('3. Checking directories...');
const requiredDirs = ['../api', '../scraper'];
let allExist = true;

for (const dir of requiredDirs) {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${dir} exists`);
  } else {
    console.log(`   ❌ ${dir} does not exist`);
    allExist = false;
  }
}

if (allExist) {
  console.log('   ✅ All required directories exist\n');
} else {
  console.log('   ⚠️  Some directories are missing\n');
}

// Test 4: Check if Dockerfile exists
console.log('4. Checking Dockerfile...');
const dockerfilePath = path.join(__dirname, 'Dockerfile');
if (fs.existsSync(dockerfilePath)) {
  console.log('   ✅ Dockerfile exists\n');
} else {
  console.log('   ❌ Dockerfile does not exist\n');
}

console.log('🎉 All tests completed!');
console.log('\n💡 To run the automation service:');
console.log('   npm run snap');
console.log('\n🔧 To run with custom parameters:');
console.log('   npm run snap -- --url http://localhost:3000 --out ./exports');