import NodeCache from 'node-cache';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  checkPeriod?: number; // Check period for expired keys
  useClone?: boolean;
  deleteOnExpire?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

export class CacheService {
  private nodeCache: NodeCache;
  private redisClient?: Redis;
  private useRedis: boolean;
  private stats = {
    hits: 0,
    misses: 0,
    operations: 0,
  };

  constructor(options: CacheOptions = {}) {
    // Initialize NodeCache for local caching
    this.nodeCache = new NodeCache({
      stdTTL: options.ttl || 600, // 10 minutes default
      checkperiod: options.checkPeriod || 120, // 2 minutes
      useClones: options.useClone !== false,
      deleteOnExpire: options.deleteOnExpire !== false,
    });

    // Initialize Redis if available
    this.useRedis = process.env.REDIS_URL !== undefined;
    if (this.useRedis) {
      this.initializeRedis();
    }

    // Setup event listeners
    this.setupEventListeners();
    
    logger.info('Cache service initialized', { 
      useRedis: this.useRedis,
      defaultTTL: options.ttl || 600 
    });
  }

  private initializeRedis() {
    try {
      this.redisClient = new Redis(process.env.REDIS_URL!, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis connected');
      });

      this.redisClient.on('error', (error) => {
        logger.error('Redis error', { error });
        this.useRedis = false;
      });

      this.redisClient.on('close', () => {
        logger.warn('Redis connection closed');
        this.useRedis = false;
      });
    } catch (error) {
      logger.error('Failed to initialize Redis', { error });
      this.useRedis = false;
    }
  }

  private setupEventListeners() {
    this.nodeCache.on('set', (key, value) => {
      logger.debug('Cache set', { key, size: JSON.stringify(value).length });
    });

    this.nodeCache.on('del', (key, value) => {
      logger.debug('Cache delete', { key });
    });

    this.nodeCache.on('expired', (key, value) => {
      logger.debug('Cache expired', { key });
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    this.stats.operations++;

    try {
      // Try Redis first if available
      if (this.useRedis && this.redisClient) {
        const redisValue = await this.redisClient.get(key);
        if (redisValue !== null) {
          this.stats.hits++;
          logger.debug('Cache hit (Redis)', { key });
          return JSON.parse(redisValue);
        }
      }

      // Fallback to NodeCache
      const nodeValue = this.nodeCache.get<T>(key);
      if (nodeValue !== undefined) {
        this.stats.hits++;
        logger.debug('Cache hit (Node)', { key });
        return nodeValue;
      }

      this.stats.misses++;
      logger.debug('Cache miss', { key });
      return undefined;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      this.stats.misses++;
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      
      // Set in Redis if available
      if (this.useRedis && this.redisClient) {
        if (ttl) {
          await this.redisClient.setex(key, ttl, serializedValue);
        } else {
          await this.redisClient.set(key, serializedValue);
        }
      }

      // Set in NodeCache
      const success = this.nodeCache.set(key, value, ttl || 0);
      
      logger.debug('Cache set', { key, ttl, success });
      return success;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      // Delete from Redis if available
      if (this.useRedis && this.redisClient) {
        await this.redisClient.del(key);
      }

      // Delete from NodeCache
      const deleted = this.nodeCache.del(key);
      
      logger.debug('Cache delete', { key, deleted });
      return deleted > 0;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      // Check Redis first if available
      if (this.useRedis && this.redisClient) {
        const exists = await this.redisClient.exists(key);
        if (exists) return true;
      }

      // Check NodeCache
      return this.nodeCache.has(key);
    } catch (error) {
      logger.error('Cache has error', { key, error });
      return false;
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      const allKeys: string[] = [];

      // Get Redis keys if available
      if (this.useRedis && this.redisClient) {
        const redisKeys = await this.redisClient.keys(pattern || '*');
        allKeys.push(...redisKeys);
      }

      // Get NodeCache keys
      const nodeKeys = this.nodeCache.keys();
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        allKeys.push(...nodeKeys.filter(key => regex.test(key)));
      } else {
        allKeys.push(...nodeKeys);
      }

      // Remove duplicates
      return [...new Set(allKeys)];
    } catch (error) {
      logger.error('Cache keys error', { error });
      return [];
    }
  }

  async flush(): Promise<void> {
    try {
      // Flush Redis if available
      if (this.useRedis && this.redisClient) {
        await this.redisClient.flushdb();
      }

      // Flush NodeCache
      this.nodeCache.flushAll();
      
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error', { error });
    }
  }

  async getStats(): Promise<CacheStats> {
    const nodeStats = this.nodeCache.getStats();
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys: nodeStats.keys,
      ksize: nodeStats.ksize,
      vsize: nodeStats.vsize,
    };
  }

  // Utility methods for common caching patterns
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    const promises = keys.map(key => this.get<T>(key));
    return Promise.all(promises);
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean[]> {
    const promises = entries.map(entry => this.set(entry.key, entry.value, entry.ttl));
    return Promise.all(promises);
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      const promises = keys.map(key => this.del(key));
      const results = await Promise.all(promises);
      
      const deletedCount = results.filter(Boolean).length;
      logger.info('Cache pattern invalidated', { pattern, deletedCount });
      
      return deletedCount;
    } catch (error) {
      logger.error('Cache pattern invalidation error', { pattern, error });
      return 0;
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;
    
    for (const tag of tags) {
      const taggedKeys = await this.keys(`tag:${tag}:*`);
      for (const taggedKey of taggedKeys) {
        const actualKey = taggedKey.replace(`tag:${tag}:`, '');
        if (await this.del(actualKey)) {
          deletedCount++;
        }
        await this.del(taggedKey); // Remove tag reference
      }
    }
    
    logger.info('Cache invalidated by tags', { tags, deletedCount });
    return deletedCount;
  }

  async setWithTags<T>(key: string, value: T, tags: string[], ttl?: number): Promise<boolean> {
    const success = await this.set(key, value, ttl);
    
    if (success) {
      // Set tag references
      const tagPromises = tags.map(tag => 
        this.set(`tag:${tag}:${key}`, true, ttl)
      );
      await Promise.all(tagPromises);
    }
    
    return success;
  }

  // Performance monitoring
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0, operations: 0 };
  }

  // Cleanup
  async close(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      this.nodeCache.close();
      logger.info('Cache service closed');
    } catch (error) {
      logger.error('Cache close error', { error });
    }
  }
}

// Create singleton instance
export const cacheService = new CacheService({
  ttl: parseInt(process.env.CACHE_TTL || '600'),
  checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '120'),
});
