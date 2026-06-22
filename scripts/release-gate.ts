import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { join } from 'path';

const commands = [
  { name: 'typecheck', cmd: 'npm run typecheck' },
  { name: 'build', cmd: 'npm run build' },
  { name: 'test', cmd: 'npm test' },
  { name: 'lint', cmd: 'npm run lint' },
  { name: 'pack', cmd: 'npm pack' }
];

let allPassed = true;

console.log('--- RUNNING RELEASE GATE CHECKS ---');

for (const step of commands) {
  try {
    console.log(`Running ${step.name} (${step.cmd})...`);
    execSync(step.cmd, { stdio: 'inherit' });
    console.log(`✅ ${step.name} passed!\n`);
  } catch {
    console.error(`❌ ${step.name} failed!\n`);
    allPassed = false;
  }
}

// Clean up any newly generated tarball from npm pack to keep the directory clean
try {
  // Find and remove any newly generated tarball matching @danijsrr/pkg-ct or similar pkg-ct version.tgz
  // e.g. danijsrr-pkg-ct-0.4.0.tgz
  const tarballPath = join(process.cwd(), 'danijsrr-pkg-ct-0.4.0.tgz');
  rmSync(tarballPath, { force: true });
} catch {
  // Ignore clean up errors
}

console.log('-----------------------------------');
if (allPassed) {
  console.log('Release Recommendation: YES');
  process.exit(0);
} else {
  console.log('Release Recommendation: NO');
  process.exit(1);
}
