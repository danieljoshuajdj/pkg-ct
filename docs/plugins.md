# Plugins

Plugins can add rules and reporters.

```ts
import type { DoctorPlugin } from '@danijsrr/pkg-ct';

const plugin: DoctorPlugin = {
  name: 'pkg-ct-plugin-vite',
  setup(api) {
    api.addRule({
      id: 'vite-major-drift',
      title: 'Vite major drift',
      run({ context }) {
        return [];
      }
    });
  }
};

export default plugin;
```

Register plugins in `pkg-ct.config.ts`:

```ts
export default defineConfig({
  plugins: ['pkg-ct-plugin-vite']
});
```
