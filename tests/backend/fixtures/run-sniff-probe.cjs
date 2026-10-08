/* eslint-disable no-undef, @typescript-eslint/no-var-requires */
// CJS launcher for sniff-probe.ts — runs the real upload.ts sniffFile() through
// ts-node and prints PROBE_JSON. Clone of run-probe.cjs; see behavior.test.mjs.
'use strict';
const path = require('node:path');

require('../../../server--backend/node_modules/ts-node').register({
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
