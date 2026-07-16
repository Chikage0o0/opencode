import upstreamAcp from "opencode-acp"
import { createSessionIsolatedAcp } from "../lib/acp-session-isolation"

export default createSessionIsolatedAcp(upstreamAcp)
