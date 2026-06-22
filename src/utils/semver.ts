import semver from 'semver';

export function satisfiesPeerRequirement(installedVersion: string | undefined, peerRange: string): boolean {
  if (!installedVersion) return true; // Missing is treated separately, not a mismatch
  
  const cleanRange = peerRange.replace(/(workspace|link|file):/g, '').trim();
  if (
    cleanRange === '*' ||
    cleanRange === 'latest' ||
    cleanRange === '^' ||
    cleanRange === '~' ||
    cleanRange === ''
  ) {
    return true;
  }
  
  const hasValidRange = Boolean(semver.validRange(cleanRange));
  if (!hasValidRange) return true;
  
  try {
    const cleanV = installedVersion.replace(/(workspace|link|file):/g, '').trim();
    if (cleanV === '*' || cleanV === 'latest' || cleanV === '' || cleanV === '^' || cleanV === '~') return true;
    
    // Direct check
    if (semver.satisfies(cleanV, cleanRange, { includePrerelease: true })) return true;
    
    // Coerce check
    const coerced = semver.coerce(cleanV);
    if (coerced && semver.satisfies(coerced.version, cleanRange, { includePrerelease: true })) return true;
    
    return false;
  } catch {
    return true;
  }
}
