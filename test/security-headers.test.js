import { test } from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

test('security headers should be present via helmet', async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  
  // Verify response is successful
  assert.strictEqual(res.status, 200, 'Health endpoint should return 200');
  
  const headers = res.headers;
  
  // X-Frame-Options: DENY
  const xFrameOptions = headers.get('x-frame-options');
  assert.ok(xFrameOptions, 'X-Frame-Options header should be present');
  assert.strictEqual(xFrameOptions.toLowerCase(), 'deny', 'X-Frame-Options should be DENY');
  
  // X-Content-Type-Options: nosniff
  const xContentTypeOptions = headers.get('x-content-type-options');
  assert.ok(xContentTypeOptions, 'X-Content-Type-Options header should be present');
  assert.strictEqual(xContentTypeOptions.toLowerCase(), 'nosniff', 'X-Content-Type-Options should be nosniff');
  
  // Strict-Transport-Security with max-age
  const hsts = headers.get('strict-transport-security');
  assert.ok(hsts, 'Strict-Transport-Security header should be present');
  assert.ok(hsts.includes('max-age'), 'HSTS should include max-age directive');
  assert.ok(hsts.includes('max-age=31536000'), 'HSTS max-age should be at least 1 year (31536000 seconds)');
  
  // Content-Security-Policy
  const csp = headers.get('content-security-policy');
  assert.ok(csp, 'Content-Security-Policy header should be present');
  assert.ok(csp.includes("default-src 'self'"), 'CSP should include default-src self directive');
  
  // Referrer-Policy
  const referrerPolicy = headers.get('referrer-policy');
  assert.ok(referrerPolicy, 'Referrer-Policy header should be present');
  
  console.log('✓ All security headers verified:');
  console.log(`  X-Frame-Options: ${xFrameOptions}`);
  console.log(`  X-Content-Type-Options: ${xContentTypeOptions}`);
  console.log(`  Strict-Transport-Security: ${hsts}`);
  console.log(`  Referrer-Policy: ${referrerPolicy}`);
});

test('security headers should apply to static routes', async () => {
  const res = await fetch(`${BASE_URL}/`);
  
  // Even if 404, headers should still be present
  const headers = res.headers;
  
  const xFrameOptions = headers.get('x-frame-options');
  assert.ok(xFrameOptions, 'X-Frame-Options should be present on all routes');
  
  const xContentTypeOptions = headers.get('x-content-type-options');
  assert.ok(xContentTypeOptions, 'X-Content-Type-Options should be present on all routes');
});
