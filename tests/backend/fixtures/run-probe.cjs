/* eslint-disable no-undef, @typescript-eslint/no-var-requires */
/**
 * CommonJS launcher for behavior-probe.ts.
 *
 * The repo root is `"type": "module"` and runs on Node 24, so invoking the
 * ts-node CLI on a `.ts` file whose nearest package.json is the root one
 * routes it through the ESM loader — which rejects the extensionless
 * relative imports used throughout server--backend/src. Registering
 * ts-node's require hook from a `.cjs` file (always CommonJS regardless of
 * `type`) compiles the probe as CommonJS instead, matching how the backend
 * itself is built.
 *
 * Hermetic: everything env.ts requires is injected by the parent test's
 * spawn env, and this directory has no .env for dotenv to find.
 */
const path = require('node:path');

// Resolve ts-node from the backend package instead of a fixed relative
// path, so resolution does not depend on the caller's cwd.
const tsNodePath = require.resolve('ts-node', {
  paths: [path.join(__dirname, '..', '..', '..', 'server--backend')],
});
require(tsNodePath).register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
    moduleResolution: 'node',
    skipLibCheck: true,
    strict: false,
  },
});

require('./behavior-probe.ts');
