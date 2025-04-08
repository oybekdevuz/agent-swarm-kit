import { makeExtendable, memoize, singleshot } from "functools-kit";
import { AgentName } from "../interfaces/Agent.interface";
import { IModelMessage } from "../model/ModelMessage.model";
import swarm from "../lib";
import { GLOBAL_CONFIG } from "../config/params";
import { PersistList, TPersistList } from "./Persist";

/**
 * Callbacks for managing history instance lifecycle and message handling.
 */
export interface IHistoryInstanceCallbacks {
  /**
   * Retrieves dynamic system prompt messages for an agent.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns An array of system prompt message contents.
   */
  getSystemPrompt?: (
    clientId: string,
    agentName: AgentName
  ) => Promise<string[]> | string[];

  /**
   * Determines whether a message should be included in the history iteration.
   * @param message - The message to evaluate.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns Whether the message passes the filter.
   */
  filterCondition?: (
    message: IModelMessage,
    clientId: string,
    agentName: AgentName
  ) => Promise<boolean> | boolean;

  /**
   * Fetches initial history data for an agent.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns The initial array of history messages.
   */
  getData: (
    clientId: string,
    agentName: AgentName
  ) => Promise<IModelMessage[]> | IModelMessage[];

  /**
   * Called when the history array changes (e.g., after push or pop).
   * @param data - The updated array of history messages.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   */
  onChange: (
    data: IModelMessage[],
    clientId: string,
    agentName: AgentName
  ) => void;

  /**
   * Called when a new message is pushed to the history.
   * @param data - The newly pushed message.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   */
  onPush: (data: IModelMessage, clientId: string, agentName: AgentName) => void;

  /**
   * Called when the last message is popped from the history.
   * @param data - The popped message, or null if the history is empty.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   */
  onPop: (
    data: IModelMessage | null,
    clientId: string,
    agentName: AgentName
  ) => void;

  /**
   * Called for each message during iteration when reading.
   * @param message - The current message being read.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   */
  onRead: (
    message: IModelMessage,
    clientId: string,
    agentName: AgentName
  ) => void;

  /**
   * Called at the start of a history read operation.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   */
  onReadBegin: (clientId: string, agentName: AgentName) => void;

  /**
   * Called at the end of a history read operation.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   */
  onReadEnd: (clientId: string, agentName: AgentName) => void;

  /**
   * Called when the history instance is disposed.
   * @param clientId - The client ID.
   */
  onDispose: (clientId: string) => void;

  /**
   * Called when the history instance is initialized.
   * @param clientId - The client ID.
   */
  onInit: (clientId: string) => void;

  /**
   * Provides a reference to the history instance after creation.
   * @param history - The history instance.
   */
  onRef: (history: IHistoryInstance) => void;
}

/**
 * Interface defining methods for interacting with a history adapter.
 */
export interface IHistoryAdapter {
  /**
   * Iterates over history messages for a client and agent.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns An async iterator yielding history messages.
   */
  iterate(
    clientId: string,
    agentName: AgentName
  ): AsyncIterableIterator<IModelMessage>;

  /**
   * Adds a new message to the history.
   * @param value - The message to add.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns A promise that resolves when the message is added.
   */
  push: (
    value: IModelMessage,
    clientId: string,
    agentName: AgentName
  ) => Promise<void>;

  /**
   * Removes and returns the last message from the history.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns The last message, or null if the history is empty.
   */
  pop: (
    clientId: string,
    agentName: AgentName
  ) => Promise<IModelMessage | null>;

  /**
   * Disposes of the history for a client and agent, optionally clearing all data.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent, or null to dispose fully.
   * @returns A promise that resolves when disposal is complete.
   */
  dispose: (clientId: string, agentName: AgentName | null) => Promise<void>;
}

/**
 * Interface defining control methods for configuring history behavior.
 */
export interface IHistoryControl {
  /**
   * Sets a custom history instance constructor for the adapter.
   * @param Ctor - The constructor for creating history instances.
   */
  useHistoryAdapter(Ctor: THistoryInstanceCtor): void;

  /**
   * Configures lifecycle callbacks for history instances.
   * @param Callbacks - The callbacks to apply.
   */
  useHistoryCallbacks: (Callbacks: Partial<IHistoryInstanceCallbacks>) => void;
}

/**
 * Interface defining methods for a history instance implementation.
 */
export interface IHistoryInstance {
  /**
   * Iterates over history messages for an agent.
   * @param agentName - The name of the agent.
   * @returns An async iterator yielding history messages.
   */
  iterate(agentName: AgentName): AsyncIterableIterator<IModelMessage>;

  /**
   * Initializes the history for an agent, loading initial data if needed.
   * @param agentName - The name of the agent.
   * @param init - Whether this is the initial setup (affects caching behavior).
   * @returns A promise that resolves when initialization is complete.
   */
  waitForInit(agentName: AgentName, init: boolean): Promise<void>;

  /**
   * Adds a new message to the history for an agent.
   * @param value - The message to add.
   * @param agentName - The name of the agent.
   * @returns A promise that resolves when the message is added.
   */
  push(value: IModelMessage, agentName: AgentName): Promise<void>;

  /**
   * Removes and returns the last message from the history for an agent.
   * @param agentName - The name of the agent.
   * @returns The last message, or null if the history is empty.
   */
  pop(agentName: AgentName): Promise<IModelMessage | null>;

  /**
   * Disposes of the history for an agent, optionally clearing all data.
   * @param agentName - The name of the agent, or null to dispose fully.
   * @returns A promise that resolves when disposal is complete.
   */
  dispose(agentName: AgentName | null): Promise<void>;
}

/**
 * Constructor type for creating history instances.
 */
export type THistoryInstanceCtor = new (
  clientId: string,
  callbacks: Partial<IHistoryInstanceCallbacks>
) => IHistoryInstance;

/** @private Symbol for memoizing the waitForInit method in HistoryMemoryInstance */
const HISTORY_MEMORY_INSTANCE_WAIT_FOR_INIT = Symbol("wait-for-init");

/** @private Symbol for memoizing the waitForInit method in HistoryPersistInstance */
const HISTORY_PERSIST_INSTANCE_WAIT_FOR_INIT = Symbol("wait-for-init");

/** @private Constant for logging the waitForInit method in HistoryMemoryInstance */
const HISTORY_MEMORY_INSTANCE_METHOD_NAME_WAIT_FOR_INIT =
  "HistoryMemoryInstance.waitForInit";

/** @private Constant for logging the constructor in HistoryMemoryInstance */
const HISTORY_MEMORY_INSTANCE_METHOD_NAME_CTOR = "HistoryMemoryInstance.CTOR";

/** @private Constant for logging the iterate method with condition in HistoryMemoryInstance */
const HISTORY_MEMORY_INSTANCE_METHOD_NAME_ITERATE_CONDITION =
  "HistoryMemoryInstance.iterate_condition";

/** @private Constant for logging the iterate method in HistoryMemoryInstance */
const HISTORY_MEMORY_INSTANCE_METHOD_NAME_ITERATE =
  "HistoryMemoryInstance.iterate";

/** @private Constant for logging the push method in HistoryMemoryInstance */
const HISTORY_MEMORY_INSTANCE_METHOD_NAME_PUSH = "HistoryMemoryInstance.push";

/** @private Constant for logging the pop method in HistoryMemoryInstance */
const HISTORY_MEMORY_INSTANCE_METHOD_NAME_POP = "HistoryMemoryInstance.pop";

/** @private Constant for logging the dispose method in HistoryMemoryInstance */
const HISTORY_MEMORY_INSTANCE_METHOD_NAME_DISPOSE =
  "HistoryMemoryInstance.dispose";

/** @private Constant for logging the waitForInit method in HistoryPersistInstance */
const HISTORY_PERSIST_INSTANCE_METHOD_NAME_WAIT_FOR_INIT =
  "HistoryPersistInstance.waitForInit";

/** @private Constant for logging the constructor in HistoryPersistInstance */
const HISTORY_PERSIST_INSTANCE_METHOD_NAME_CTOR = "HistoryPersistInstance.CTOR";

/** @private Constant for logging the iterate method with condition in HistoryPersistInstance */
const HISTORY_PERSIST_INSTANCE_METHOD_NAME_ITERATE_CONDITION =
  "HistoryPersistInstance.iterate_condition";

/** @private Constant for logging the iterate method in HistoryPersistInstance */
const HISTORY_PERSIST_INSTANCE_METHOD_NAME_ITERATE =
  "HistoryPersistInstance.iterate";

/** @private Constant for logging the push method in HistoryPersistInstance */
const HISTORY_PERSIST_INSTANCE_METHOD_NAME_PUSH = "HistoryPersistInstance.push";

/** @private Constant for logging the pop method in HistoryPersistInstance */
const HISTORY_PERSIST_INSTANCE_METHOD_NAME_POP = "HistoryPersistInstance.pop";

/** @private Constant for logging the dispose method in HistoryPersistInstance */
const HISTORY_PERSIST_INSTANCE_METHOD_NAME_DISPOSE =
  "HistoryPersistInstance.dispose";

/** @private Constant for logging the useHistoryAdapter method in HistoryUtils */
const METHOD_NAME_USE_HISTORY_ADAPTER = "HistoryUtils.useHistoryAdapter";

/** @private Constant for logging the useHistoryCallbacks method in HistoryUtils */
const METHOD_NAME_USE_HISTORY_CALLBACKS = "HistoryUtils.useHistoryCallbacks";

/** @private Constant for logging the iterate method in HistoryUtils */
const METHOD_NAME_ITERATE = "HistoryUtils.iterate";

/** @private Constant for logging the push method in HistoryUtils */
const METHOD_NAME_PUSH = "HistoryUtils.push";

/** @private Constant for logging the pop method in HistoryUtils */
const METHOD_NAME_POP = "HistoryUtils.pop";

/** @private Constant for logging the dispose method in HistoryUtils */
const METHOD_NAME_DISPOSE = "HistoryUtils.dispose";

/**
 * Initializes the memory-based history instance by loading initial data.
 * @private
 * @param agentName - The name of the agent.
 * @param self - The history instance.
 * @returns A promise that resolves when initialization is complete.
 */
const HISTORY_MEMORY_INSTANCE_WAIT_FOR_INIT_FN = async (
  agentName: AgentName,
  self: THistoryMemoryInstance
): Promise<void> => {
  GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
    swarm.loggerService.debug(
      HISTORY_MEMORY_INSTANCE_METHOD_NAME_WAIT_FOR_INIT,
      {
        clientId: self.clientId,
        agentName,
      }
    );
  if (self.callbacks.getData) {
    self._array = await self.callbacks.getData(self.clientId, agentName);
  }
};

/**
 * Initializes the persistent history instance by loading data from storage.
 * @private
 * @param agentName - The name of the agent.
 * @param self - The history instance.
 * @returns A promise that resolves when initialization is complete.
 */
const HISTORY_PERSIST_INSTANCE_WAIT_FOR_INIT_FN = async (
  agentName: AgentName,
  self: THistoryPersistInstance
): Promise<void> => {
  GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
    swarm.loggerService.debug(
      HISTORY_PERSIST_INSTANCE_METHOD_NAME_WAIT_FOR_INIT,
      {
        clientId: self.clientId,
        agentName,
      }
    );
  await self._persistStorage.waitForInit(true);
  for await (const message of self._persistStorage) {
    self._array.push(message);
  }
};

/**
 * Manages a persistent history of messages, storing them in memory and on disk.
 * @implements {IHistoryInstance}
 */
export const HistoryPersistInstance = makeExtendable(
  class implements IHistoryInstance {
    /** @private The in-memory array of history messages */
    _array: IModelMessage[] = [];

    /** @private The persistent storage instance for history messages */
    _persistStorage: TPersistList;

    /**
     * Memoized initialization function to ensure it runs only once per agent.
     * @private
     * @param agentName - The name of the agent.
     * @returns A promise that resolves when initialization is complete.
     */
    [HISTORY_PERSIST_INSTANCE_WAIT_FOR_INIT] = singleshot(
      async (agentName: AgentName): Promise<void> =>
        await HISTORY_PERSIST_INSTANCE_WAIT_FOR_INIT_FN(agentName, this)
    );

    /**
     * Initializes the history for an agent, loading data from persistent storage if needed.
     * @param agentName - The name of the agent.
     * @returns A promise that resolves when initialization is complete.
     */
    async waitForInit(agentName: AgentName): Promise<void> {
      return await this[HISTORY_PERSIST_INSTANCE_WAIT_FOR_INIT](agentName);
    }

    /**
     * Creates a new persistent history instance.
     * Invokes onInit and onRef callbacks if provided.
     * @param clientId - The client ID.
     * @param callbacks - The lifecycle callbacks.
     */
    constructor(
      readonly clientId: string,
      readonly callbacks: Partial<IHistoryInstanceCallbacks>
    ) {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(HISTORY_PERSIST_INSTANCE_METHOD_NAME_CTOR, {
          clientId: this.clientId,
        });
      this._persistStorage = new PersistList(
        this.clientId,
        `./logs/data/history`
      );
      if (callbacks.onInit) {
        callbacks.onInit(clientId);
      }
      if (callbacks.onRef) {
        callbacks.onRef(this);
      }
      if (callbacks.filterCondition) {
        this.iterate = async function* (
          agentName: AgentName
        ): AsyncIterableIterator<IModelMessage> {
          GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
            swarm.loggerService.debug(
              HISTORY_PERSIST_INSTANCE_METHOD_NAME_ITERATE_CONDITION,
              {
                clientId: this.clientId,
                agentName,
              }
            );
          if (this.callbacks.onRead) {
            this.callbacks.onReadBegin &&
              this.callbacks.onReadBegin(this.clientId, agentName);
            for (const item of this._array) {
              if (
                await this.callbacks.filterCondition(
                  item,
                  this.clientId,
                  agentName
                )
              ) {
                this.callbacks.onRead(item, this.clientId, agentName);
                yield item;
              }
            }
            if (this.callbacks.getSystemPrompt) {
              for (const content of await this.callbacks.getSystemPrompt(
                this.clientId,
                agentName
              )) {
                yield {
                  role: "system",
                  content,
                  agentName,
                  mode: "tool",
                };
              }
            }
            this.callbacks.onReadEnd &&
              this.callbacks.onReadEnd(this.clientId, agentName);
            return;
          }
          this.callbacks.onReadBegin &&
            this.callbacks.onReadBegin(this.clientId, agentName);
          for (const item of this._array) {
            if (
              await this.callbacks.filterCondition(
                item,
                this.clientId,
                agentName
              )
            ) {
              yield item;
            }
          }
          if (this.callbacks.getSystemPrompt) {
            for (const content of await this.callbacks.getSystemPrompt(
              this.clientId,
              agentName
            )) {
              yield {
                role: "system",
                content,
                agentName,
                mode: "tool",
              };
            }
          }
          this.callbacks.onReadEnd &&
            this.callbacks.onReadEnd(this.clientId, agentName);
        };
      }
    }

    /**
     * Iterates over history messages, applying filters and system prompts if configured.
     * Invokes onRead callbacks during iteration if provided.
     * @param agentName - The name of the agent.
     * @returns An async iterator yielding filtered messages.
     */
    async *iterate(
      agentName: AgentName
    ): AsyncIterableIterator<IModelMessage> {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(
          HISTORY_PERSIST_INSTANCE_METHOD_NAME_ITERATE,
          {
            clientId: this.clientId,
            agentName,
          }
        );
      if (this.callbacks.onRead) {
        this.callbacks.onReadBegin &&
          this.callbacks.onReadBegin(this.clientId, agentName);
        for (const item of this._array) {
          this.callbacks.onRead(item, this.clientId, agentName);
          yield item;
        }
        this.callbacks.onReadEnd &&
          this.callbacks.onReadEnd(this.clientId, agentName);
        return;
      }
      this.callbacks.onReadBegin &&
        this.callbacks.onReadBegin(this.clientId, agentName);
      for (const item of this._array) {
        yield item;
      }
      if (this.callbacks.getSystemPrompt) {
        for (const content of await this.callbacks.getSystemPrompt(
          this.clientId,
          agentName
        )) {
          yield {
            role: "system",
            content,
            agentName,
            mode: "tool",
          };
        }
      }
      this.callbacks.onReadEnd &&
        this.callbacks.onReadEnd(this.clientId, agentName);
    }

    /**
     * Adds a new message to the history, persisting it to storage.
     * Invokes onPush and onChange callbacks if provided.
     * @param value - The message to add.
     * @param agentName - The name of the agent.
     * @returns A promise that resolves when the message is persisted.
     */
    async push(
      value: IModelMessage,
      agentName: AgentName
    ): Promise<void> {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(HISTORY_PERSIST_INSTANCE_METHOD_NAME_PUSH, {
          clientId: this.clientId,
          agentName,
        });
      this.callbacks.onPush &&
        this.callbacks.onPush(value, this.clientId, agentName);
      this._array.push(value);
      this.callbacks.onChange &&
        this.callbacks.onChange(this._array, this.clientId, agentName);
      await this._persistStorage.push(value);
    }

    /**
     * Removes and returns the last message from the history, updating persistent storage.
     * Invokes onPop and onChange callbacks if provided.
     * @param agentName - The name of the agent.
     * @returns The last message, or null if the history is empty.
     */
    async pop(agentName: AgentName): Promise<IModelMessage | null> {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(HISTORY_PERSIST_INSTANCE_METHOD_NAME_POP, {
          clientId: this.clientId,
          agentName,
        });
      const value = this._array.pop() ?? null;
      this.callbacks.onPop &&
        this.callbacks.onPop(value, this.clientId, agentName);
      this.callbacks.onChange &&
        this.callbacks.onChange(this._array, this.clientId, agentName);
      await this._persistStorage.pop();
      return value;
    }

    /**
     * Disposes of the history, clearing all data if agentName is null.
     * Invokes onDispose callback if provided.
     * @param agentName - The name of the agent, or null to clear all data.
     * @returns A promise that resolves when disposal is complete.
     */
    async dispose(agentName: AgentName | null): Promise<void> {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(
          HISTORY_PERSIST_INSTANCE_METHOD_NAME_DISPOSE,
          {
            clientId: this.clientId,
            agentName,
          }
        );
      if (agentName === null) {
        this.callbacks.onDispose && this.callbacks.onDispose(this.clientId);
        this._array = [];
      }
      return;
    }
  }
);

/**
 * Type alias for an instance of HistoryPersistInstance.
 */
export type THistoryPersistInstance = InstanceType<typeof HistoryPersistInstance>;

/**
 * Manages an in-memory history of messages without persistence.
 * @implements {IHistoryInstance}
 */
export const HistoryMemoryInstance = makeExtendable(
  class implements IHistoryInstance {
    /** @private The in-memory array of history messages */
    _array: IModelMessage[] = [];

    /**
     * Memoized initialization function to ensure it runs only once per agent.
     * @private
     * @param agentName - The name of the agent.
     * @returns A promise that resolves when initialization is complete.
     */
    [HISTORY_MEMORY_INSTANCE_WAIT_FOR_INIT] = singleshot(
      async (agentName: AgentName): Promise<void> =>
        await HISTORY_MEMORY_INSTANCE_WAIT_FOR_INIT_FN(agentName, this)
    );

    /**
     * Initializes the history for an agent, loading initial data if needed.
     * @param agentName - The name of the agent.
     * @returns A promise that resolves when initialization is complete.
     */
    async waitForInit(agentName: AgentName): Promise<void> {
      return await this[HISTORY_MEMORY_INSTANCE_WAIT_FOR_INIT](agentName);
    }

    /**
     * Creates a new in-memory history instance.
     * Invokes onInit and onRef callbacks if provided.
     * @param clientId - The client ID.
     * @param callbacks - The lifecycle callbacks.
     */
    constructor(
      readonly clientId: string,
      readonly callbacks: Partial<IHistoryInstanceCallbacks>
    ) {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(HISTORY_MEMORY_INSTANCE_METHOD_NAME_CTOR, {
          clientId: this.clientId,
        });
      if (callbacks.onInit) {
        callbacks.onInit(clientId);
      }
      if (callbacks.onRef) {
        callbacks.onRef(this);
      }
      if (callbacks.filterCondition) {
        this.iterate = async function* (
          agentName: AgentName
        ): AsyncIterableIterator<IModelMessage> {
          GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
            swarm.loggerService.debug(
              HISTORY_MEMORY_INSTANCE_METHOD_NAME_ITERATE_CONDITION,
              {
                clientId: this.clientId,
                agentName,
              }
            );
          if (this.callbacks.onRead) {
            this.callbacks.onReadBegin &&
              this.callbacks.onReadBegin(this.clientId, agentName);
            for (const item of this._array) {
              if (
                await this.callbacks.filterCondition(
                  item,
                  this.clientId,
                  agentName
                )
              ) {
                this.callbacks.onRead(item, this.clientId, agentName);
                yield item;
              }
            }
            if (this.callbacks.getSystemPrompt) {
              for (const content of await this.callbacks.getSystemPrompt(
                this.clientId,
                agentName
              )) {
                yield {
                  role: "system",
                  content,
                  agentName,
                  mode: "tool",
                };
              }
            }
            this.callbacks.onReadEnd &&
              this.callbacks.onReadEnd(this.clientId, agentName);
            return;
          }
          this.callbacks.onReadBegin &&
            this.callbacks.onReadBegin(this.clientId, agentName);
          for (const item of this._array) {
            if (
              await this.callbacks.filterCondition(
                item,
                this.clientId,
                agentName
              )
            ) {
              yield item;
            }
          }
          if (this.callbacks.getSystemPrompt) {
            for (const content of await this.callbacks.getSystemPrompt(
              this.clientId,
              agentName
            )) {
              yield {
                role: "system",
                content,
                agentName,
                mode: "tool",
              };
            }
          }
          this.callbacks.onReadEnd &&
            this.callbacks.onReadEnd(this.clientId, agentName);
        };
      }
    }

    /**
     * Iterates over history messages, applying filters and system prompts if configured.
     * Invokes onRead callbacks during iteration if provided.
     * @param agentName - The name of the agent.
     * @returns An async iterator yielding filtered messages.
     */
    async *iterate(
      agentName: AgentName
    ): AsyncIterableIterator<IModelMessage> {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(HISTORY_MEMORY_INSTANCE_METHOD_NAME_ITERATE, {
          clientId: this.clientId,
          agentName,
        });
      if (this.callbacks.onRead) {
        this.callbacks.onReadBegin &&
          this.callbacks.onReadBegin(this.clientId, agentName);
        for (const item of this._array) {
          this.callbacks.onRead(item, this.clientId, agentName);
          yield item;
        }
        this.callbacks.onReadEnd &&
          this.callbacks.onReadEnd(this.clientId, agentName);
        return;
      }
      this.callbacks.onReadBegin &&
        this.callbacks.onReadBegin(this.clientId, agentName);
      for (const item of this._array) {
        yield item;
      }
      if (this.callbacks.getSystemPrompt) {
        for (const content of await this.callbacks.getSystemPrompt(
          this.clientId,
          agentName
        )) {
          yield {
            role: "system",
            content,
            agentName,
            mode: "tool",
          };
        }
      }
      this.callbacks.onReadEnd &&
        this.callbacks.onReadEnd(this.clientId, agentName);
    }

    /**
     * Adds a new message to the in-memory history.
     * Invokes onPush and onChange callbacks if provided.
     * @param value - The message to add.
     * @param agentName - The name of the agent.
     * @returns A promise that resolves when the message is added.
     */
    async push(
      value: IModelMessage,
      agentName: AgentName
    ): Promise<void> {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(HISTORY_MEMORY_INSTANCE_METHOD_NAME_PUSH, {
          clientId: this.clientId,
          agentName,
        });
      this.callbacks.onPush &&
        this.callbacks.onPush(value, this.clientId, agentName);
      this._array.push(value);
      this.callbacks.onChange &&
        this.callbacks.onChange(this._array, this.clientId, agentName);
      return Promise.resolve();
    }

    /**
     * Removes and returns the last message from the in-memory history.
     * Invokes onPop and onChange callbacks if provided.
     * @param agentName - The name of the agent.
     * @returns The last message, or null if the history is empty.
     */
    async pop(agentName: AgentName): Promise<IModelMessage | null> {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(HISTORY_MEMORY_INSTANCE_METHOD_NAME_POP, {
          clientId: this.clientId,
          agentName,
        });
      const value = this._array.pop() ?? null;
      this.callbacks.onPop &&
        this.callbacks.onPop(value, this.clientId, agentName);
      this.callbacks.onChange &&
        this.callbacks.onChange(this._array, this.clientId, agentName);
      return Promise.resolve(value);
    }

    /**
     * Disposes of the history, clearing all data if agentName is null.
     * Invokes onDispose callback if provided.
     * @param agentName - The name of the agent, or null to clear all data.
     * @returns A promise that resolves when disposal is complete.
     */
    async dispose(agentName: AgentName | null): Promise<void> {
      GLOBAL_CONFIG.CC_LOGGER_ENABLE_DEBUG &&
        swarm.loggerService.debug(HISTORY_MEMORY_INSTANCE_METHOD_NAME_DISPOSE, {
          clientId: this.clientId,
          agentName,
        });
      if (agentName === null) {
        this.callbacks.onDispose && this.callbacks.onDispose(this.clientId);
        this._array = [];
      }
      return Promise.resolve();
    }
  }
);

/**
 * Type alias for an instance of HistoryMemoryInstance.
 */
export type THistoryMemoryInstance = InstanceType<typeof HistoryMemoryInstance>;

/**
 * Provides utilities for managing history instances, supporting both memory and persistent storage.
 * @implements {IHistoryAdapter}
 * @implements {IHistoryControl}
 */
export class HistoryUtils implements IHistoryAdapter, IHistoryControl {
  /** @private The custom history instance constructor, if set */
  private HistoryFactory: THistoryInstanceCtor;

  /** @private The configured lifecycle callbacks for history instances */
  private HistoryCallbacks: Partial<IHistoryInstanceCallbacks> = {};

  /**
   * Memoized function to create or retrieve a history instance for a client.
   * Defaults to HistoryPersistInstance or HistoryMemoryInstance based on global config.
   * @private
   * @param clientId - The client ID.
   * @returns The history instance for the client.
   */
  private getHistory = memoize(
    ([clientId]: [string]): string => clientId,
    (clientId: string): IHistoryInstance => {
      if (this.HistoryFactory) {
        return Reflect.construct(this.HistoryFactory, [
          clientId,
          this.HistoryCallbacks,
        ]);
      }
      return GLOBAL_CONFIG.CC_PERSIST_ENABLED_BY_DEFAULT
        ? Reflect.construct(HistoryPersistInstance, [
            clientId,
            this.HistoryCallbacks,
          ])
        : Reflect.construct(HistoryMemoryInstance, [
            clientId,
            this.HistoryCallbacks,
          ]);
    }
  );

  /**
   * Sets a custom history instance constructor for the adapter.
   * @param Ctor - The constructor for creating history instances.
   */
  public useHistoryAdapter = (Ctor: THistoryInstanceCtor): void => {
    GLOBAL_CONFIG.CC_LOGGER_ENABLE_LOG &&
      swarm.loggerService.log(METHOD_NAME_USE_HISTORY_ADAPTER);
    this.HistoryFactory = Ctor;
  };

  /**
   * Configures lifecycle callbacks for all history instances created by this adapter.
   * @param Callbacks - The callbacks to apply.
   */
  public useHistoryCallbacks = (
    Callbacks: Partial<IHistoryInstanceCallbacks>
  ): void => {
    GLOBAL_CONFIG.CC_LOGGER_ENABLE_LOG &&
      swarm.loggerService.log(METHOD_NAME_USE_HISTORY_CALLBACKS);
    Object.assign(this.HistoryCallbacks, Callbacks);
  };

  /**
   * Iterates over history messages for a client and agent, ensuring initialization.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns An async iterator yielding history messages.
   */
  public async *iterate(
    clientId: string,
    agentName: AgentName
  ): AsyncIterableIterator<IModelMessage> {
    GLOBAL_CONFIG.CC_LOGGER_ENABLE_LOG &&
      swarm.loggerService.log(METHOD_NAME_ITERATE, {
        clientId,
        agentName,
      });
    const isInitial = !this.getHistory.has(clientId);
    const history = await this.getHistory(clientId);
    await history.waitForInit(agentName, isInitial);
    for await (const item of history.iterate(agentName)) {
      yield item;
    }
  }

  /**
   * Adds a new message to the history for a client and agent, ensuring initialization.
   * @param value - The message to add.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns A promise that resolves when the message is added.
   */
  public push = async (
    value: IModelMessage,
    clientId: string,
    agentName: AgentName
  ): Promise<void> => {
    GLOBAL_CONFIG.CC_LOGGER_ENABLE_LOG &&
      swarm.loggerService.log(METHOD_NAME_PUSH, {
        clientId,
        agentName,
        value,
      });
    const isInitial = !this.getHistory.has(clientId);
    const history = await this.getHistory(clientId);
    await history.waitForInit(agentName, isInitial);
    return await history.push(value, agentName);
  };

  /**
   * Removes and returns the last message from the history for a client and agent.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent.
   * @returns The last message, or null if the history is empty.
   */
  public pop = async (
    clientId: string,
    agentName: AgentName
  ): Promise<IModelMessage | null> => {
    GLOBAL_CONFIG.CC_LOGGER_ENABLE_LOG &&
      swarm.loggerService.log(METHOD_NAME_POP, {
        clientId,
        agentName,
      });
    const isInitial = !this.getHistory.has(clientId);
    const history = await this.getHistory(clientId);
    await history.waitForInit(agentName, isInitial);
    return await history.pop(agentName);
  };

  /**
   * Disposes of the history for a client and agent, clearing data if agentName is null.
   * @param clientId - The client ID.
   * @param agentName - The name of the agent, or null to dispose fully.
   * @returns A promise that resolves when disposal is complete.
   */
  public dispose = async (
    clientId: string,
    agentName: AgentName | null
  ): Promise<void> => {
    GLOBAL_CONFIG.CC_LOGGER_ENABLE_LOG &&
      swarm.loggerService.log(METHOD_NAME_DISPOSE, {
        clientId,
        agentName,
      });
    if (!this.getHistory.has(clientId)) {
      return;
    }
    const history = await this.getHistory(clientId);
    await history.waitForInit(agentName ?? "default", false);
    await history.dispose(agentName);
    if (agentName === null) {
      this.getHistory.clear(clientId);
    }
  };
}

/**
 * Singleton instance of HistoryUtils implementing the history adapter interface.
 * @type {IHistoryAdapter & IHistoryControl}
 */
export const HistoryAdapter = new HistoryUtils();

/**
 * Exported History Control interface for configuring history behavior.
 * @type {IHistoryControl}
 */
export const History = HistoryAdapter as IHistoryControl;

export default HistoryAdapter;
