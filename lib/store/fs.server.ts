import "server-only"
import { setFs } from "./fs"
import { nodeFs } from "./fs.node"

/**
 * Installs the Node filesystem backend for the web build.
 *
 * Imported for its side effect — `import "@/lib/store/fs.server"` and nothing
 * else — by every server entry point that can reach the store: `lib/data.ts` and
 * the action modules. Registering at each entry rather than once somewhere
 * central is what makes it order-independent: an import's side effect runs
 * before the importing module's body, so whichever entry a request arrives
 * through, the backend is in place before `registry.ts` is asked for anything.
 * `setFs` is idempotent, so several entries doing it is not a problem.
 *
 * The `server-only` guard is the point of the file. It makes "did any of this
 * leak into the client bundle?" a build error rather than something discovered
 * when the desktop export fails to resolve `node:fs`.
 *
 * The desktop build never imports this — see `components/TauriBootstrap.tsx` —
 * and the CLI scripts install `nodeFs` themselves, since `server-only` would
 * refuse to load under `tsx`.
 */
setFs(nodeFs)
