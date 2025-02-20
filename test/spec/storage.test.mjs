import { test } from "worker-testbed";

import {
  addEmbedding,
  addStorage,
  addAgent,
  addCompletion,
  Storage,
} from "../../build/index.mjs";

import { randomString } from "functools-kit";

test("Will keep separate storages for different connections", async ({
  pass,
  fail,
}) => {
  const TEST_COMPLETION = addCompletion({
    completionName: "test_completion",
    getCompletion: async ({ agentName, messages }) => {
      const [{ content }] = messages.slice(-1);
      return {
        agentName,
        content,
        role: "assistant",
      };
    },
  });

  const TEST_EMBEDDING = addEmbedding({
    embeddingName: "test_embedding",
    calculateSimilarity: () => 1.0,
    createEmbedding: () => [],
  });

  const TEST_STORAGE = addStorage({
    embedding: TEST_EMBEDDING,
    createIndex: ({ foo }) => foo,
  });

  const TEST_AGENT = addAgent({
    agentName: "test_agent",
    completion: TEST_COMPLETION,
    prompt: "You are a mock agent which will return Hello world",
    storages: [TEST_STORAGE],
  });

  const CLIENT_ID1 = randomString();
  const CLIENT_ID2 = randomString();

  Storage.upsert({ id: "test", foo: "bar" }, CLIENT_ID1, TEST_AGENT, TEST_STORAGE);
  Storage.upsert({ id: "test", foo: "baz" }, CLIENT_ID2, TEST_AGENT, TEST_STORAGE);

  const [{ foo: test1 }] = await Storage.list(CLIENT_ID1, TEST_AGENT, TEST_STORAGE);
  const [{ foo: test2 }] = await Storage.list(CLIENT_ID2, TEST_AGENT, TEST_STORAGE);

  if (test1 !== "bar") {
    fail("CLIENT1 is broken");
  }

  if (test2 !== "baz") {
    fail("CLIENT2 is broken");
  }

  pass();
});


test("Will raise an exception if storage is not declared in agent", async ({
  pass,
  fail,
}) => {
  const TEST_COMPLETION = addCompletion({
    completionName: "test_completion",
    getCompletion: async ({ agentName, messages }) => {
      const [{ content }] = messages.slice(-1);
      return {
        agentName,
        content,
        role: "assistant",
      };
    },
  });

  const TEST_EMBEDDING = addEmbedding({
    embeddingName: "test_embedding",
    calculateSimilarity: () => 1.0,
    createEmbedding: () => [],
  });

  const TEST_STORAGE = addStorage({
    embedding: TEST_EMBEDDING,
    createIndex: ({ foo }) => foo,
  });

  const TEST_AGENT = addAgent({
    agentName: "test_agent",
    completion: TEST_COMPLETION,
    prompt: "You are a mock agent which will return Hello world",
  });

  const CLIENT_ID = randomString();

  try {
    await Storage.upsert(
      { id: "test", foo: "bar" },
      CLIENT_ID,
      TEST_AGENT,
      TEST_STORAGE
    );
    fail();
  } catch {
    pass();
  }
});
