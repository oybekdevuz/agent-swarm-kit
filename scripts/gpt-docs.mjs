import { globSync } from "glob";
import { basename, join, extname, resolve } from "path";
import { str, retry } from "functools-kit";
import { Ollama } from "ollama";
import { Agent, setGlobalDispatcher } from "undici";
import fs from "fs";

setGlobalDispatcher(
  new Agent({
    headersTimeout: 60 * 60 * 1000,
    bodyTimeout: 0,
  })
);

const MODULE_NAME = "agent-swarm-kit";

const ollama = new Ollama({ host: "http://127.0.0.1:11434" });

const DISALLOWED_TEXT = ["Summary:", "System:", "#"];

const GPT_CLASS_PROMPT =
  "Please write a summary for that Typescript API Reference of AI agent swarm orchestration framework with several sentences in more human way";

const GPT_INTERFACE_PROMPT =
  "Please write a summary for that Typescript API Reference of AI agent swarm orchestration framework with several sentences in more human way";

const GPT_TOTAL_PROMPT =
  "Please write a summary for the whole swarm orchestration framework based on API Reference with several sentences in more human way. Describe the core parts like Validation services, Schema services, Connection services, Public services, bus and method context. Describe the IAgent, ISwarm, IAgentTool. Skip the callbacks and lifecycle";

console.log("Loading model");

await ollama.pull({
  model: "gemma3:12b",
});

const generateDescription = retry(
  async (filePath, prompt) => {
    console.log(`Generating content for ${resolve(filePath)}`);

    const data = fs.readFileSync(filePath).toString();

    const messages = [
      {
        content: prompt,
        role: "system",
      },
      {
        content: str.newline(
          'Do not write the header like "Okay, here’s a human-friendly summary".',
          'Do not write the header like "Okay, this is a comprehensive overview".',
          "Write the countent only like you are writing doc file directly.",
          `Write the human text only without markdown symbols epecially like: ${DISALLOWED_TEXT.map(
            (v) => `"${v}"`
          ).join(", ")}`,
          `You still can use lists and new lines if need`,
          "Do not write any headers started with #",
          'Never recommend anything else like "Would you like me to:"',
          "Never ask me about any information",
          "Never say ok or confirm you doing something"
        ),
        role: "system",
      },
      {
        content: data,
        role: "user",
      },
    ];

    let content;
    console.time("EXECUTE");
    try {
      const {
        message: { content: c },
      } = await ollama.chat({
        model: "gemma3:12b",
        keep_alive: "8h",
        options: {
          num_ctx: 48_000,
        },
        messages,
      });
      content = c;
    } catch (error) {
      console.error(`Caught an error for ${filePath}`, error);
      throw error;
    } finally {
      console.timeEnd("EXECUTE");
    }

    if (
      DISALLOWED_TEXT.some((text) =>
        content.toLowerCase().includes(text.toLowerCase())
      )
    ) {
      console.warn(`Found disallowed symbols for ${filePath}`);
      let result;
      console.time("EXECUTE");
      try {
        const {
          message: { content: r },
        } = await ollama.chat({
          model: "gemma3:12b",
          keep_alive: "8h",
          options: {
            num_ctx: 48_000,
          },
          messages: [
            ...messages,
            {
              content,
              role: "assistant",
            },
            {
              content:
                "I found dissalowed symbols in the output. Write the result correct",
              role: "user",
            },
          ],
        });
        result = r;
      } catch (error) {
        console.error(`Caught an error for ${filePath} (fix attempt)`);
        throw error;
      } finally {
        console.timeEnd("EXECUTE");
      }
      return result;
    }

    return content;
  },
  Number.POSITIVE_INFINITY,
  5_000
);

const outputPath = join(process.cwd(), "docs", `internals.md`);
const output = [];

output.push("---");
output.push(`title: docs/internals`);
output.push(`group: docs`);
output.push("---");
output.push("");

{
  const classList = globSync(`./docs/classes/*`);
  output.push(`# ${MODULE_NAME} classes`);
  output.push("");
  if (!classList.length) {
    output.push("No data available");
  }
  for (const classPath of classList) {
    const className = basename(classPath, extname(classPath));
    const content = await generateDescription(classPath, GPT_CLASS_PROMPT);
    if (content.trim()) {
      output.push(`## Class ${className}`);
      output.push("");
      output.push(content);
      output.push("");
    }
    fs.writeFileSync(outputPath, output.join("\n"));
  }
}

{
  const interfaceList = globSync(`./docs/interfaces/*`);
  output.push(`# ${MODULE_NAME} interfaces`);
  output.push("");
  if (!interfaceList.length) {
    output.push("No data available");
  }
  for (const interfacePath of interfaceList) {
    const interfaceName = basename(interfacePath, extname(interfacePath));
    const content = await generateDescription(
      interfacePath,
      GPT_INTERFACE_PROMPT
    );
    if (content.trim()) {
      output.push(`## Interface ${interfaceName}`);
      output.push("");
      output.push(content);
      output.push("");
    }
    fs.writeFileSync(outputPath, output.join("\n"));
  }
}

{
  output.unshift("");
  output.unshift(await generateDescription(outputPath, GPT_TOTAL_PROMPT));
  output.unshift("");
  output.unshift("![schema](../assets/uml.svg)");
  output.unshift("");
  output.unshift(`# ${MODULE_NAME} api reference`);
  fs.writeFileSync(outputPath, output.join("\n"));
}
