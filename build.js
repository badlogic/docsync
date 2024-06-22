const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/main.ts'],
  outfile: 'build/docsync.js',
  bundle: true,
  platform: 'node',
  sourcemap: true
}).catch(() => process.exit(1));