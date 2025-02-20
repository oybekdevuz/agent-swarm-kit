import { execpool, memoize, singleshot, SortedArray } from "functools-kit";
import {
  IStorage,
  IStorageData,
  IStorageParams,
} from "../interfaces/Storage.interface";
import { GLOBAL_CONFIG } from "../config/params";

/**
 * ClientStorage class to manage storage operations.
 * @template T - The type of storage data.
 */
export class ClientStorage<T extends IStorageData = IStorageData>
  implements IStorage<T>
{
  private _itemMap = new Map<IStorageData["id"], T>();

  /**
   * Creates an instance of ClientStorage.
   * @param {IStorageParams<T>} params - The storage parameters.
   */
  constructor(readonly params: IStorageParams<T>) {
    this.params.logger.debug(
      `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} CTOR`,
      {
        params,
      }
    );
  }

  /**
   * Creates an embedding for the given item.
   * @param {T} item - The item to create an embedding for.
   * @returns {Promise<readonly [any, any]>} - The embeddings and index.
   */
  _createEmbedding = memoize(
    ([{ id }]) => id,
    async (item: T) => {
      this.params.logger.debug(
        `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} _createEmbedding`,
        {
          id: item.id,
        }
      );
      const index = await this.params.createIndex(item);
      const embeddings = await this.params.createEmbedding(index);
      if (this.params.onCreate) {
        this.params.onCreate(
          index,
          embeddings,
          this.params.clientId,
          this.params.embedding
        );
      }
      return [embeddings, index] as const;
    }
  );

  /**
   * Waits for the initialization of the storage.
   * @returns {Promise<void>}
   */
  waitForInit = singleshot(async () => {
    this.params.logger.debug(
      `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} waitForInit`
    );
    if (!this.params.getData) {
        return;
    }
    const data = await this.params.getData(
      this.params.clientId,
      this.params.storageName
    );
    await Promise.all(
      data.map(
        execpool(this._createEmbedding, {
          delay: 10,
          maxExec: GLOBAL_CONFIG.CC_STORAGE_SEARCH_POOL,
        })
      )
    );
    this._itemMap = new Map(data.map((item) => [item.id, item]));
  });

  /**
   * Takes a specified number of items based on the search criteria.
   * @param {string} search - The search string.
   * @param {number} total - The total number of items to take.
   * @param {number} [score=GLOBAL_CONFIG.CC_STORAGE_SEARCH_SIMILARITY] - The similarity score.
   * @returns {Promise<T[]>} - The list of items.
   */
  take = async (search: string, total: number, score = GLOBAL_CONFIG.CC_STORAGE_SEARCH_SIMILARITY): Promise<T[]> => {
    this.params.logger.debug(
      `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} take`,
      {
        search,
        total,
      }
    );
    const indexed = new SortedArray<IStorageData>();
    const searchEmbeddings = await this.params.createEmbedding(search);
    if (this.params.onCreate) {
      this.params.onCreate(
        search,
        searchEmbeddings,
        this.params.clientId,
        this.params.embedding
      );
    }
    await Promise.all(
      Array.from(this._itemMap.values()).map(
        execpool(
          async (item) => {
            const [targetEmbeddings, index] = await this._createEmbedding(item);
            const score = await this.params.calculateSimilarity(
              searchEmbeddings,
              targetEmbeddings
            );
            if (this.params.onCompare) {
              this.params.onCompare(
                search,
                index,
                score,
                this.params.clientId,
                this.params.embedding
              );
            }
            indexed.push({ id: item.id }, score);
          },
          {
            delay: 10,
            maxExec: GLOBAL_CONFIG.CC_STORAGE_SEARCH_POOL,
          }
        )
      )
    );
    this.params.logger.debug(`ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} take indexed`,{
        indexed: indexed.getEntries(),
    })
    const filtered = indexed.take(
      total,
      score,
    );
    return filtered.map(({ id }) => this._itemMap.get(id));
  };

  /**
   * Upserts an item into the storage.
   * @param {T} item - The item to upsert.
   * @returns {Promise<void>}
   */
  upsert = async (item: T) => {
    this.params.logger.debug(
      `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} upsert`,
      {
        item,
      }
    );
    this._itemMap.set(item.id, item);
    this._createEmbedding.clear(item.id);
    await this._createEmbedding(item);
    if (this.params.callbacks?.onUpdate) {
      this.params.callbacks?.onUpdate(
        [...this._itemMap.values()],
        this.params.clientId,
        this.params.storageName
      );
    }
  };

  /**
   * Removes an item from the storage.
   * @param {IStorageData["id"]} itemId - The ID of the item to remove.
   * @returns {Promise<void>}
   */
  remove = async (itemId: IStorageData["id"]) => {
    this.params.logger.debug(
      `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} remove`,
      {
        id: itemId,
      }
    );
    this._itemMap.delete(itemId);
    this._createEmbedding.clear(itemId);
    if (this.params.callbacks?.onUpdate) {
      this.params.callbacks?.onUpdate(
        [...this._itemMap.values()],
        this.params.clientId,
        this.params.storageName
      );
    }
  };

  /**
   * Clears all items from the storage.
   * @returns {Promise<void>}
   */
  clear = async () => {
    this.params.logger.debug(
      `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} clear`
    );
    this._itemMap.clear();
    this._createEmbedding.clear();
  };

  /**
   * Gets an item by its ID.
   * @param {IStorageData["id"]} itemId - The ID of the item to get.
   * @returns {Promise<T | null>} - The item or null if not found.
   */
  get = async (itemId: IStorageData["id"]): Promise<T | null> => {
    this.params.logger.debug(
      `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} get`,
      {
        id: itemId,
      }
    );
    return this._itemMap.get(itemId) ?? null;
  };

  /**
   * Lists all items in the storage, optionally filtered by a predicate.
   * @param {(item: T) => boolean} [filter] - The filter predicate.
   * @returns {Promise<T[]>} - The list of items.
   */
  list = async (filter?: (item: T) => boolean) => {
    this.params.logger.debug(
      `ClientStorage storageName=${this.params.storageName} clientId=${this.params.clientId} list`
    );
    if (!filter) {
      return [...this._itemMap.values()];
    }
    const result: T[] = [];
    for (const item of this._itemMap.values()) {
      if (filter(item)) {
        result.push(item);
      }
    }
    return result;
  };
}

export default ClientStorage;
