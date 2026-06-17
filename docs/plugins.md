# Plugins

Plugins can add rules and reporters.

```ts
import type { DoctorPlugin } from 'pkgdoctor';

const plugin: DoctorPlugin = {
  name: 'pkgdoctor-plugin-vite',
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

Register plugins in `pkgdoctor.config.ts`:

```ts
export default defineConfig({
  plugins: ['pkgdoctor-plugin-vite']
});
```
