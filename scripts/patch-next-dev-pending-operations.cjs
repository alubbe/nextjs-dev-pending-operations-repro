const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const GLOBAL_PATCH_FLAG = '__NEXT_DEV_PENDING_OPERATIONS_PATCH_INSTALLED__';

if (!globalThis[GLOBAL_PATCH_FLAG]) {
  globalThis[GLOBAL_PATCH_FLAG] = true;

  const targets = [
    path.join('next', 'dist', 'compiled', 'next-server', 'app-page.runtime.dev.js'),
    path.join('next', 'dist', 'compiled', 'next-server', 'app-page-turbo.runtime.dev.js'),
  ].map((suffix) => `${path.sep}${suffix}`);

  const replacements = [
    {
      find: 'pendingOperations=new Map,lastRanAwait=null,',
      replace:
        'pendingOperations=new Map,lastRanAwait=null,markAsyncSequenceRootTaskInDEV=globalThis.__NEXT_DEV_PENDING_OPERATIONS_MARK_CURRENT_ASYNC_ROOT__=function(){pendingOperations.delete(async_hooks.executionAsyncId())},',
    },
    {
      find:
        'return res.setHeader("Location",redirectUrl),{type:"done",result:RenderResult.EMPTY}}if((0,http_access_fallback.isHTTPAccessFallbackError)(err)){',
      replace:
        'return globalThis.__NEXT_DEV_PENDING_OPERATIONS_MARK_CURRENT_ASYNC_ROOT__&&globalThis.__NEXT_DEV_PENDING_OPERATIONS_MARK_CURRENT_ASYNC_ROOT__(),res.setHeader("Location",redirectUrl),{type:"done",result:RenderResult.EMPTY}}if((0,http_access_fallback.isHTTPAccessFallbackError)(err)){',
    },
  ];

  const originalJsExtension = Module._extensions['.js'];

  Module._extensions['.js'] = function patchedJsExtension(module, filename) {
    if (!targets.some((target) => filename.endsWith(target))) {
      return originalJsExtension(module, filename);
    }

    let source = fs.readFileSync(filename, 'utf8');

    for (const { find, replace } of replacements) {
      if (!source.includes(find)) {
        throw new Error(
          `Next pending-operations patch anchor not found in ${filename}: ${find}`,
        );
      }

      source = source.replace(find, replace);
    }

    module._compile(source, filename);
  };
}
