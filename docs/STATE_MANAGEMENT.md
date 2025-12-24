# State Management Architecture

This document is the authoritative reference for Hector Studio's state management.

## Single Writer Pattern (Critical)

Each piece of renderer state has **exactly one writer** to prevent race conditions:

| State | Initial Loader | Event Handler | Writer Count |
|-------|---------------|---------------|--------------|
| `workspacesEnabled` | `useServersInit` | `useStateInit` | ✅ 1 logical |
| `licenseStatus` | `useLicenseInit` | `useStateInit` | ✅ 1 logical |
| `serverStatus` | `useServersInit` | `useServersInit` (IPC events) | ✅ 1 |
| `activeServerId` | localStorage | UI components | ✅ 1 |

**Components NEVER write serverStatus directly.** Status changes go through:
1. `api.server.probe(id)` → main probes → emits `server:status-change`
2. `api.auth.logout(url)` → main logs out → emits `server:status-change`

## Key Invariants

1. **Main is Truth**: All state derives from main process
2. **Workspaces Require License**: `workspacesEnabled → isLicensed`
3. **Local Selection Requires Feature**: `activeServer.isLocal → workspacesEnabled`
4. **Valid Selection**: `activeServerId → servers[activeServerId] exists`

## Writers by Hook

| Hook | Writes To | Reads From |
|------|-----------|------------|
| `useServersInit` | `servers`, `serverStatus`, `workspacesEnabled` | Main via IPC |
| `useLicenseInit` | `licenseStatus` | Main via IPC |
| `useStateInit` | `licenseStatus`, `workspacesEnabled` | `app:state-changed` event |
| `useHealthPolling` | `serverStatus` | HTTP `/health` |

## Sync Protocol

### On Load
1. `useLicenseInit`: Fetches license status
2. `useServersInit`: Fetches servers, probes health for local workspaces, loads workspacesEnabled
3. `useStateInit`: Subscribes to `app:state-changed` for unified updates

### Event-Driven Updates
- `server:status-change`: Workspace lifecycle (checking → authenticated)
- `app:state-changed`: License/workspaces state changes

## Race Condition Handling

| Race | Mitigation |
|------|------------|
| Event before server exists | Await `syncFromMain()`, re-fetch |
| Reload misses 'running' event | HTTP health probe on load |
| Stale localStorage activeServerId | Validate after sync, clear if missing |

## Files

- `src/main/state/coordinator.ts` - Central state orchestration
- `src/main/hector/manager.ts` - Workspace process management
- `src/main/servers/manager.ts` - Server list persistence
- `src/renderer/src/lib/hooks/useServersInit.ts` - Server sync hook
- `src/renderer/src/lib/hooks/useLicenseInit.ts` - License init hook
- `src/renderer/src/lib/hooks/useStateInit.ts` - Unified state event hook
- `src/renderer/src/store/serversStore.ts` - Zustand store
