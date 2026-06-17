import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import type { DoctorConfig, FindingCategory, RequiredDoctorConfig, Severity } from '../types/index.js';
import { pathExists } from '../utils/fs.js';

const severitySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);

const configSchema = z.object({
  root: z.string().optional(),
  offline: z.boolean().optional(),
  ai: z
    .object({
      provider: z.enum(['none', 'openai', 'anthropic', 'ollama', 'local']).optional(),
      model: z.string().optional(),
      baseUrl: z.string().optional(),
      apiKeyEnv: z.string().optional()
    })
    .optional(),
  ignorePackages: z.array(z.string()).optional(),
  rules: z.record(z.union([z.boolean(), z.record(z.unknown())])).optional(),
  scoring: z.record(z.string(), z.number().positive()).optional(),
  ci: z
    .object({
      failOn: severitySchema.optional(),
      minScore: z.number().min(0).max(100).optional()
    })
    .optional(),
  plugins: z.array(z.string()).optional()
});

const defaultWeights: Record<FindingCategory, number> = {
  hygiene: 1,
  security: 1.5,
  freshness: 0.9,
  duplication: 1,
  maintainability: 1.2,
  'install-performance': 1,
  'runtime-impact': 0.8,
  'bundle-impact': 0.8,
  compatibility: 1.3
};

export async function loadConfig(root: string, overrides: DoctorConfig = {}): Promise<RequiredDoctorConfig> {
  const resolvedRoot = resolve(overrides.root ?? root);
  const file = await findConfigFile(resolvedRoot);
  let loaded: DoctorConfig = {};

  if (file) {
    const mod = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)) as {
      default?: DoctorConfig;
      config?: DoctorConfig;
    };
    loaded = mod.default ?? mod.config ?? {};
  }

  const parsed = configSchema.parse({ ...loaded, ...overrides, root: resolvedRoot }) as DoctorConfig;
  return {
    root: parsed.root ?? resolvedRoot,
    offline: parsed.offline ?? true,
    ai: parsed.ai ?? { provider: 'none' },
    ignorePackages: parsed.ignorePackages ?? [],
    rules: parsed.rules ?? {},
    scoring: { ...defaultWeights, ...(parsed.scoring ?? {}) } as Record<FindingCategory, number>,
    ci: {
      failOn: (parsed.ci?.failOn ?? 'high') as Severity,
      minScore: parsed.ci?.minScore ?? 70
    },
    plugins: parsed.plugins ?? []
  };
}

async function findConfigFile(root: string): Promise<string | undefined> {
  const candidates = [
    'depdoctor.config.ts',
    'depdoctor.config.mts',
    'depdoctor.config.js',
    'depdoctor.config.mjs',
    '.depdoctorrc.json',
    'node-modules-doctor.config.ts',
    'node-modules-doctor.config.mts',
    'node-modules-doctor.config.js',
    'node-modules-doctor.config.mjs',
    '.nodemodulesdoctorrc.json'
  ];
  for (const name of candidates) {
    const file = join(root, name);
    if (await pathExists(file)) return file;
  }
  return undefined;
}

export function defineConfig(config: DoctorConfig): DoctorConfig {
  return config;
}
