# State Management Architecture

This document is the authoritative reference for Hector Studio's state management.

## Quick Reference

| Concept | Location |
|---------|----------|
| Source of truth | Main process (`src/main/`) |
| Renderer sync | `useServersInit`, `useStateInit` hooks |
| Persistence | electron-store (main), localStorage (activeServerId only) |

## Key Invariants

1. **Main is Truth**: All state derives from main process
2. **Workspaces Require License**: `workspacesEnabled → isLicensed`
3. **Local Selection Requires Feature**: `activeServer.isLocal → workspacesEnabled`
4. **Valid Selection**: `activeServerId → servers[activeServerId] exists`

## Sync Protocol

### On Load
1. `useServersInit`: Fetches servers, probes health for local workspaces
2. `useStateInit`: Subscribes to `app:state-changed` for unified updates

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
- `src/renderer/src/lib/hooks/useStateInit.ts` - Unified state hook
- `src/renderer/src/store/serversStore.ts` - Zustand store
