export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type FindingCategory =
  | 'hygiene'
  | 'security'
  | 'freshness'
  | 'duplication'
  | 'maintainability'
  | 'install-performance'
  | 'runtime-impact'
  | 'bundle-impact'
  | 'compatibility';

export interface DoctorConfig {
  root?: string;
  offline?: boolean;
  ai?: {
    provider?: 'none' | 'openai' | 'anthropic' | 'ollama' | 'local';
    model?: string;
    baseUrl?: string;
    apiKeyEnv?: string;
  };
  ignorePackages?: string[];
  rules?: Record<string, boolean | Record<string, unknown>>;
  scoring?: Partial<Record<FindingCategory, number>>;
  ci?: {
    failOn?: Severity;
    minScore?: number;
  };
  plugins?: string[];
}

export interface WorkspaceProject {
  name: string;
  path: string;
  packageJsonPath: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
}

export interface ProjectContext {
  root: string;
  packageManager: PackageManager;
  lockfile?: string | undefined;
  isMonorepo: boolean;
  workspaceGlobs: string[];
  workspaces: WorkspaceProject[];
  rootProject: WorkspaceProject;
  config: RequiredDoctorConfig;
}

export interface SourceUsage {
  usedPackages: Set<string>;
  packageUsage: Map<string, PackageUsage>;
  filesScanned: number;
  importCount: number;
}

export type DependencyRole =
  | 'CORE_RUNTIME'
  | 'FRAMEWORK'
  | 'BUILD_TOOL'
  | 'BUILD_RUNTIME'
  | 'CONFIG_TOOL'
  | 'TRANSITIVE'
  | 'OPTIONAL'
  | 'DEVELOPMENT'
  | 'TEST_TOOL'
  | 'LINTER'
  | 'TRANSPILER'
  | 'BUNDLER'
  | 'UNKNOWN';

export interface PackageUsageEvidence {
  source: 'source' | 'config' | 'script' | 'ci' | 'framework' | 'weak' | 'none';
  file?: string | undefined;
  detail: string;
  confidence: number;
}

export interface PackageUsage {
  name: string;
  confidence: number;
  evidence: PackageUsageEvidence[];
  safeRemovalProbability: number;
  role: DependencyRole;
}

export interface LockfileAnalysis {
  type: PackageManager;
  packageCount: number;
  duplicatePackages: Map<string, string[]>;
  missingDirectDependencies: string[];
  staleDirectDependencies: string[];
  evidence: string[];
}

export interface AuditVulnerability {
  name: string;
  severity: Severity;
  title: string;
  url?: string | undefined;
  range?: string | undefined;
  fixAvailable: boolean;
  via: string[];
}

export interface AuditResult {
  vulnerabilities: AuditVulnerability[];
  metadata?: Record<string, unknown> | undefined;
  unavailableReason?: string | undefined;
}

export interface RequiredDoctorConfig
  extends Omit<
    DoctorConfig,
    'root' | 'offline' | 'ai' | 'ignorePackages' | 'rules' | 'scoring' | 'ci' | 'plugins'
  > {
  root: string;
  offline: boolean;
  ai: NonNullable<DoctorConfig['ai']>;
  ignorePackages: string[];
  rules: Record<string, boolean | Record<string, unknown>>;
  scoring: Record<FindingCategory, number>;
  ci: {
    failOn: Severity;
    minScore: number;
  };
  plugins: string[];
}

export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  spec?: string | undefined;
  path?: string | undefined;
  depth: number;
  dev?: boolean | undefined;
  optional?: boolean | undefined;
  peer?: boolean | undefined;
  bundled?: boolean | undefined;
  deprecated?: string | undefined;
  license?: string | undefined;
  engines?: Record<string, string> | undefined;
  peerDependencies: Record<string, string>;
  dependencies: Record<string, string>;
  dependents: string[];
  sizeBytes: number;
  scripts: Record<string, string>;
  repository?: string | undefined;
  homepage?: string | undefined;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'prod' | 'dev' | 'peer' | 'optional' | 'workspace' | 'transitive';
  spec?: string | undefined;
}

export interface DependencyGraph {
  rootId: string;
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  byName: Map<string, string[]>;
}

export interface PackageIntelligence {
  name: string;
  latest?: string | undefined;
  deprecated?: string | undefined;
  publishedAt?: string | undefined;
  weeklyDownloads?: number | undefined;
  maintainers?: number | undefined;
  license?: string | undefined;
  repository?: string | undefined;
  versions?: string[] | undefined;
  ageDays?: number | undefined;
  isOutdated?: boolean | undefined;
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  category: FindingCategory;
  severity: Severity;
  packageName?: string;
  packageVersion?: string;
  workspace?: string;
  evidence: string[];
  recommendation: string;
  fix?: FixAction;
  confidence: number;
}

export interface FixAction {
  type: 'remove' | 'dedupe' | 'install' | 'upgrade' | 'lockfile-repair' | 'manual';
  title: string;
  commands: string[];
  safe: boolean;
  requiresInstall: boolean;
}

export interface ScoreBreakdown {
  category: FindingCategory;
  score: number;
  weight: number;
  deductions: number;
  explanation: string;
}

export interface HealthScore {
  overall: number;
  breakdown: ScoreBreakdown[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface RemediationPlan {
  id: string;
  title: string;
  priority: number;
  difficulty: 'easy' | 'medium' | 'hard';
  impact: 'low' | 'medium' | 'high';
  actions: FixAction[];
  rationale: string;
}

export interface AnalysisResult {
  context: ProjectContext;
  graph: DependencyGraph;
  findings: Finding[];
  score: HealthScore;
  remediation: RemediationPlan[];
  usage: SourceUsage;
  lockfileAnalysis: LockfileAnalysis;
  audit: AuditResult;
  packageIntelligence: PackageIntelligence[];
  generatedAt: string;
  durationMs: number;
  aiSummary?: string;
  /** Identifies which analyzer pipeline produced this result. */
  pipeline: 'SCAN_PIPELINE' | 'ANALYZE_PIPELINE' | 'DOCTOR_PIPELINE';
}

export interface ExplainResult {
  packageName: string;
  nodes: DependencyNode[];
  chains: DependencyNode[][];
  duplicates: DependencyNode[];
  findings: Finding[];
  installImpactBytes: number;
  health?: PackageIntelligence | undefined;
  role: DependencyRole;
  referencedBy: string[];
  usageConfidence: number;
  safeRemovalProbabilityPercent: number;
  removalRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  safeRemovalProbability: 'LOW' | 'MEDIUM' | 'HIGH';
  alternatives: string[];
  /** How many packages would be impacted if this package were removed. */
  blastRadius: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  blastRadiusCount: number;
  /** Whether this package reaches production at runtime. */
  productionImpact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  /** Direct dependents in the graph (packages that list this as a dep). */
  directDependents: string[];
}

export interface ReporterOptions {
  format?: 'terminal' | 'json' | 'markdown' | 'html' | 'ci';
  output?: string;
  ci?: boolean;
  verbose?: boolean;
}

export interface ScanOptions extends ReporterOptions {
  root: string;
  offline?: boolean;
  ai?: boolean;
  onlineMetadata?: boolean;
  audit?: boolean;
  unused?: boolean;
}

export interface FixOptions {
  root: string;
  dryRun: boolean;
  interactive: boolean;
  ci: boolean;
  install: boolean;
}

export interface DoctorPlugin {
  name: string;
  version?: string;
  setup(api: PluginApi): void | Promise<void>;
}

export interface PluginApi {
  addRule(rule: Rule): void;
  addReporter(name: string, reporter: Reporter): void;
}

export interface Rule {
  id: string;
  title: string;
  run(input: RuleInput): Finding[] | Promise<Finding[]>;
}

export interface RuleInput {
  context: ProjectContext;
  graph: DependencyGraph;
  intelligence: Map<string, PackageIntelligence>;
  usage: SourceUsage;
  lockfileAnalysis: LockfileAnalysis;
  audit: AuditResult;
}

export interface Reporter {
  render(result: AnalysisResult, options?: ReporterOptions): string | Promise<string>;
}
