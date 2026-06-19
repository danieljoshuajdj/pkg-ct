export { analyzeProject, scanProject, doctorProject } from './core/analyzer.js';
export { explainPackage } from './core/explain.js';
export { buildDependencyGraph, traceChains } from './graph/graph.js';
export { scoreFindings } from './health/scoring.js';
export { predictInstallRisk } from './risk/predictor.js';
export { adviseUpgrade } from './risk/upgrade-advisor.js';
export { createFixPlan, runFixes } from './fixers/fix-engine.js';
export { defineConfig, loadConfig } from './config/index.js';
export { calculateBlastRadius } from './graph/blast.js';
export { classifyProductionPackages } from './scanner/production.js';
export { calculateAging } from './health/aging.js';
export { generateSecurityReport } from './scanner/security.js';
export { detectMissingDependencies } from './scanner/missing-deps.js';
export type * from './types/index.js';

