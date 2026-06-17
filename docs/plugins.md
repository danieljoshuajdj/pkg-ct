# Plugins

Plugins can add rules and reporters.

```ts
import type { DoctorPlugin } from 'depdoctor';

const plugin: DoctorPlugin = {
  name: 'depdoctor-plugin-vite',
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

Register plugins in `depdoctor.config.ts`:

```ts
export default defineConfig({
  plugins: ['depdoctor-plugin-vite']
});
```
