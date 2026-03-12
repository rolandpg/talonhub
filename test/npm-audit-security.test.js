import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';

/**
 * Regression test for VULN-003, VULN-004, VULN-007
 * Ensures no high or critical vulnerabilities in dependencies
 */
test('npm audit should have 0 high/critical vulnerabilities', () => {
  try {
    // Run npm audit in json format to parse results
    const auditOutput = execSync('npm audit --json', { 
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // If command succeeds, no vulnerabilities found
    assert.ok(true, 'npm audit passed with no vulnerabilities');
  } catch (error) {
    // npm audit exits with error code if vulnerabilities found
    // Parse the output to check severity levels
    const output = error.stdout || error.message;
    
    let auditData;
    try {
      auditData = JSON.parse(output);
    } catch {
      // If not valid JSON, check the text output
      const hasHighVuln = /(\d+) high/.test(output) && !/0 high/.test(output);
      const hasCriticalVuln = /(\d+) critical/.test(output) && !/0 critical/.test(output);
      
      assert.strictEqual(hasHighVuln, false, 'Found HIGH severity vulnerabilities - run npm audit for details');
      assert.strictEqual(hasCriticalVuln, false, 'Found CRITICAL severity vulnerabilities - run npm audit for details');
      return;
    }
    
    // Check metadata for vulnerability counts
    const vulnerabilities = auditData.metadata?.vulnerabilities || {};
    const highCount = vulnerabilities.high || 0;
    const criticalCount = vulnerabilities.critical || 0;
    
    assert.strictEqual(highCount, 0, `Found ${highCount} HIGH severity vulnerabilities - run npm audit for details`);
    assert.strictEqual(criticalCount, 0, `Found ${criticalCount} CRITICAL severity vulnerabilities - run npm audit for details`);
  }
});

test('tar dependency should be at patched version >= 7.5.11', () => {
  try {
    const tarVersion = execSync('npm list tar --json', {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    
    const tarData = JSON.parse(tarVersion);
    const dependencies = tarData.dependencies || {};
    
    // Find tar in dependency tree
    let tarInfo = dependencies.tar;
    if (!tarInfo) {
      // Check nested dependencies
      for (const dep of Object.values(dependencies)) {
        if (dep?.dependencies?.tar) {
          tarInfo = dep.dependencies.tar;
          break;
        }
      }
    }
    
    assert.ok(tarInfo, 'tar dependency should be found');
    const version = tarInfo.version;
    assert.ok(version, 'tar version should be defined');
    
    // Parse version and check >= 7.5.11
    const [major, minor, patch] = version.split('.').map(Number);
    const isPatched = major > 7 || (major === 7 && minor > 5) || (major === 7 && minor === 5 && patch >= 11);
    
    assert.ok(isPatched, `tar version ${version} should be >= 7.5.11 to fix VULN-003, VULN-004, VULN-007`);
  } catch (error) {
    if (error.status === 1) {
      // npm list may exit with 1 for extraneous packages, check output anyway
      const output = error.stdout || '{}';
      const tarData = JSON.parse(output);
      assert.ok(tarData.dependencies?.tar || Object.values(tarData.dependencies || {}).some(d => d?.dependencies?.tar), 
        'tar dependency should exist in project');
      return;
    }
    throw error;
  }
});
