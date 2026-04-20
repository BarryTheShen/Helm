import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:8000/openapi.json',
  output: {
    path: 'src/api/generated',
    format: 'prettier',
  },
  plugins: [
    '@hey-api/client-fetch',
    {
      name: '@hey-api/sdk',
      asClass: false,
    },
    'zod',
  ],
});
