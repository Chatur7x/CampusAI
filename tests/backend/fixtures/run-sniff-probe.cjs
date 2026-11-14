/* eslint-disable no-undef, @typescript-eslint/no-var-requires */
// CJS launcher for sniff-probe.ts — runs the real upload.ts sniffFile() through
// ts-node and prints PROBE_JSON. Clone of run-probe.cjs; see behavior.test.mjs.
'use strict';
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
    target: 'es2022',
    esModuleInterop: true,
    strict: false,
  },
});

require(path.join(__dirname, 'sniff-probe.ts'));
