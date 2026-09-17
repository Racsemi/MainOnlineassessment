import { executeCodeInSandbox } from './index';

async function testRunner() {
  console.log('🧪 Testing Sandboxed Code Runner...');

  const jsTest = await executeCodeInSandbox({
    language: 'javascript',
    sourceCode: `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length >= 2) {
    const a = parseInt(input[0], 10);
    const b = parseInt(input[1], 10);
    console.log(a + b);
}`,
    testCases: [
      { input: '3 5', expectedOutput: '8', isHidden: false },
      { input: '10 20', expectedOutput: '30', isHidden: true }
    ]
  });

  console.log('Result:', JSON.stringify(jsTest, null, 2));
  if (jsTest.passedTestCases === 2) {
    console.log('✅ Code runner verified successfully!');
  } else {
    console.error('❌ Code runner test failed!');
  }
}

if (require.main === module) {
  testRunner();
}
