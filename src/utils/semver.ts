import semver from 'semver';

export type DuplicateVersionDistance = 'patch' | 'minor' | 'major' | 'multi-major' | 'unknown';

export interface DuplicateVersionProfile {
  distance: DuplicateVersionDistance;
  severity: 'low' | 'medium' | 'high';
  majors: number;
  explanation: string;
}

/**
 * Classify duplicate versions by SemVer distance. Patch/minor duplication is
 * intentionally low severity because it does not cross a breaking-change
 * boundary. Non-SemVer values stay low because their distance is not provable.
 */
export function classifyDuplicateVersions(versions: Iterable<string>): DuplicateVersionProfile {
  const parsed = [...new Set(versions)]
    .map((version) => semver.parse(version) ?? semver.coerce(version))
    .filter((version): version is semver.SemVer => Boolean(version));

  if (parsed.length < 2) {
    return {
      distance: 'unknown',
      severity: 'low',
      majors: parsed.length,
      explanation: 'Version distance could not be established from SemVer metadata.'
    };
  }

  const majors = new Set(parsed.map((version) => version.major));
  if (majors.size >= 3) {
    return {
      distance: 'multi-major',
      severity: 'high',
      majors: majors.size,
      explanation: `${majors.size} major lines are installed; migration may require multiple breaking-change steps.`
    };
  }
  if (majors.size === 2) {
    return {
      distance: 'major',
      severity: 'medium',
      majors: majors.size,
      explanation: 'Two major lines are installed; their APIs may be intentionally incompatible.'
    };
  }

  const minors = new Set(parsed.map((version) => version.minor));
  if (minors.size > 1) {
    return {
      distance: 'minor',
      severity: 'low',
      majors: 1,
      explanation: 'Versions differ only within one major line; this is normally compatible SemVer variation.'
    };
  }

  return {
    distance: 'patch',
    severity: 'low',
    majors: 1,
    explanation: 'Versions differ only by patch release; this is normal dependency-tree variation.'
  };
}

/**
 * Determine if installedVersion satisfies the peerRange.
 * Strips workspace/file/link prefixes and handles semver ranges properly.
 */
export function satisfiesPeerRequirement(installedVersion: string | undefined, peerRange: string): boolean {
  if (!installedVersion) return false;
  
  // Remove any workspace/link/file prefix (globally).
  const cleanRange = peerRange.replace(/(?:workspace:|link:|file:)/g, '').trim();
  
  // If range is empty or wildcard, treat it as satisfied.
  if (!cleanRange || cleanRange === '*' || cleanRange === 'latest') return true;
  
  // Clean installed version as well
  const cleanV = installedVersion.replace(/(?:workspace:|link:|file:)/g, '').trim();
  if (!cleanV || cleanV === '*' || cleanV === 'latest') return true;

  // Validate range syntax first.
  if (!semver.validRange(cleanRange)) {
    // If range is something like a git commit, skip.
    return false;
  }

  // Direct check
  if (semver.satisfies(cleanV, cleanRange, { includePrerelease: true })) return true;

  // Coerce installed version (handles things like "19.x").
  const coerced = semver.coerce(cleanV);
  if (!coerced) return false;
  
  // Use semver.satisfies with prerelease included.
  return semver.satisfies(coerced.version, cleanRange, { includePrerelease: true });
}
