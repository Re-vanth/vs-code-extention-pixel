const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

/**
 * Bundles the extension host and the webview.
 *
 * The extension host bundle is CommonJS for Node, the webview bundle is an
 * IIFE that runs in the browser. The webview stylesheet is copied alongside
 * the script so both can be served through `asWebviewUri`.
 */

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  external: ['vscode'],
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: ['webview/src/main.ts'],
  bundle: true,
  outfile: 'webview/dist/main.js',
  platform: 'browser',
  target: 'es2020',
  format: 'iife',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

function copyStyles() {
  const dist = path.join(__dirname, 'webview', 'dist');
  fs.mkdirSync(dist, { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, 'webview', 'src', 'styles', 'main.css'),
    path.join(dist, 'main.css')
  );
}

async function main() {
  copyStyles();

  const contexts = await Promise.all([
    esbuild.context(extensionConfig),
    esbuild.context(webviewConfig),
  ]);

  if (watch) {
    await Promise.all(contexts.map((context) => context.watch()));
    console.log('watching for changes...');
  } else {
    await Promise.all(contexts.map((context) => context.rebuild()));
    await Promise.all(contexts.map((context) => context.dispose()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
