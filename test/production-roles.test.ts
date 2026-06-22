import { describe, expect, it } from 'vitest';
import { getRoleAndClassification } from '../src/scanner/production.js';

describe('production role classification validation', () => {
  it('classifies react as FRAMEWORK and Production critical', () => {
    const { role, classification } = getRoleAndClassification({ name: 'react', dev: false });
    expect(role).toBe('FRAMEWORK');
    expect(classification).toBe('Production critical');
  });

  it('classifies vite as BUNDLER and Build only even when dev status is not true', () => {
    const { role, classification } = getRoleAndClassification({ name: 'vite', dev: false });
    expect(role).toBe('BUNDLER');
    expect(classification).toBe('Build only');
  });

  it('classifies typescript as TRANSPILER and Build only even when dev is falsy', () => {
    const { role, classification } = getRoleAndClassification({ name: 'typescript', dev: undefined });
    expect(role).toBe('TRANSPILER');
    expect(classification).toBe('Build only');
  });

  it('classifies eslint as LINTER and Development only even when dev is falsy', () => {
    const { role, classification } = getRoleAndClassification({ name: 'eslint', dev: undefined });
    expect(role).toBe('LINTER');
    expect(classification).toBe('Development only');
  });

  it('deterministically maintains some Unknown mappings for unrecognized dev transitive packages', () => {
    // Unrecognized dev packages should sometimes map to 'Unknown' and sometimes to 'Development only'
    const results = Array.from({ length: 30 }, (_, i) => {
      return getRoleAndClassification({ name: `pkg-${i}`, dev: true });
    });
    const unknowns = results.filter((r) => r.classification === 'Unknown');
    const devOnly = results.filter((r) => r.classification === 'Development only');
    
    expect(unknowns.length).toBeGreaterThan(0);
    expect(devOnly.length).toBeGreaterThan(0);
    // Unknowns should be less than 30% of total
    expect(unknowns.length / results.length).toBeLessThan(0.3);
  });
});
