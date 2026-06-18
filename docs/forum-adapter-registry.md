# Forum Adapter Registry

Forum adapters convert a concrete forum page shape into ThreadTrace's canonical `ThreadSnapshot`.

The default registry includes the built-in NGA adapter. Runtime composition can inject another registry:

```js
const { createForumAdapterRegistry, getForumAdapter } = require('./src/infrastructure/forum-adapters/registry');

const forumAdapterRegistry = createForumAdapterRegistry([
  getForumAdapter('nga'),
  customForumAdapter
]);

const runtime = createThreadTraceRuntime({
  forumAdapterRegistry
});
```

## Adapter Contract

```text
ForumAdapter
  sourceKey: string
  displayName?: string
  parseSavedHtml(html, context) -> ThreadSnapshot
```

## Diagnostics

Forum adapter diagnostics verify that registered adapters have stable metadata, can be resolved from the registry, implement `parseSavedHtml`, and optionally pass sample parse smoke checks.

```text
runtime.diagnoseAdapters()
GET /api/adapters/diagnostics
node src/presentation/cli/threadtrace.js adapter-diagnostics
```

Forum adapters should only understand source-specific page structure. They should not manage task lifecycle, source cursors, notifications, storage, or scheduling. Those responsibilities stay in application use cases and runtime composition.

Source ingest handlers decide whether a forum adapter is required. The built-in `saved-html-directory` and `thread-url` handlers require an adapter; API-native or already-normalized custom sources can skip adapters by using a custom `SourceIngestHandler` with `requiresAdapter: false`.
