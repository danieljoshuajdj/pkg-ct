  import { execSync } from 'child_process';
  import { rmSync, readFileSync } from 'fs';
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
    const packageJsonPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const scopeAndName = pkg.name.startsWith('@') ? pkg.name.slice(1).replace('/', '-') : pkg.name;
    const tarballName = `${scopeAndName}-${pkg.version}.tgz`;
    const tarballPath = join(process.cwd(), tarballName);
    console.log(`Cleaning up generated tarball: ${tarballName}...`);
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

