import { dumpDocs } from "agent-swarm-kit";
import plantuml from "plantuml";

import "./lib/swarm";

await dumpDocs("demo/vllm-docker-cuda", './docs/chat', plantuml);

process.kill(process.pid);
