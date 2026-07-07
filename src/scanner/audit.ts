import { execa } from 'execa';
import type { AuditResult, AuditVulnerability, ProjectContext, Severity } from '../types/index.js';

type NpmAuditJson = {
  vulnerabilities?: Record<
    string,
    {
      name?: string;
      severity?: Severity;
      title?: string;
      range?: string;
      fixAvailable?: boolean | Record<string, unknown>;
      via?: Array<string | { title?: string; url?: string }>;
    }
  >;
  metadata?: Record<string, unknown>;
};

export async function runAudit(context: ProjectContext, enabled = false): Promise<AuditResult> {
  if (!enabled) return { vulnerabilities: [] };
  if (context.packageManager !== 'npm') {
    return {
      vulnerabilities: [],
      unavailableReason: `Audit normalization currently supports npm lockfiles; detected ${context.packageManager}.`
    };
  }

  try {
    const result = await execa('npm', ['audit', '--json'], {
      cwd: context.root,
      reject: false,
      all: true,
      shell: true
    });
    const json = JSON.parse(result.stdout || '{}') as NpmAuditJson;
    return {
      vulnerabilities: Object.entries(json.vulnerabilities ?? {}).map(([name, vulnerability]) =>
        normalizeVulnerability(name, vulnerability)
      ),
      metadata: json.metadata
    };
  } catch (error) {
    return {
      vulnerabilities: [],
      unavailableReason: error instanceof Error ? error.message : 'npm audit failed.'
    };
  }
}

function normalizeVulnerability(
  name: string,
  vulnerability: NonNullable<NpmAuditJson['vulnerabilities']>[string]
): AuditVulnerability {
  const via = vulnerability.via ?? [];
  const advisory = via.find((item): item is { title?: string; url?: string } => typeof item === 'object');
  return {
    name: vulnerability.name ?? name,
    severity: vulnerability.severity ?? 'medium',
    title: vulnerability.title ?? advisory?.title ?? `${name} vulnerability`,
    url: advisory?.url,
    range: vulnerability.range,
    fixAvailable: Boolean(vulnerability.fixAvailable),
    via: via.map((item) => (typeof item === 'string' ? item : (item.title ?? item.url ?? 'advisory')))
  };
}
