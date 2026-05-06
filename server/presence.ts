import Redis from "ioredis";

export interface PresenceStore {
  setRoomUser(roomCode: string, userId: string): Promise<void>;
  removeRoomUser(roomCode: string, userId: string): Promise<void>;
}

export class MemoryPresenceStore implements PresenceStore {
  async setRoomUser(): Promise<void> {
    return;
  }

  async removeRoomUser(): Promise<void> {
    return;
  }
}

export class RedisPresenceStore implements PresenceStore {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
  }

  async setRoomUser(roomCode: string, userId: string): Promise<void> {
    await this.redis.connect().catch(() => undefined);
    await this.redis.sadd(`room:${roomCode}:users`, userId);
    await this.redis.expire(`room:${roomCode}:users`, 60 * 60);
  }

  async removeRoomUser(roomCode: string, userId: string): Promise<void> {
    await this.redis.connect().catch(() => undefined);
    await this.redis.srem(`room:${roomCode}:users`, userId);
  }
}

export function createPresenceStore(): PresenceStore {
  return process.env.REDIS_URL ? new RedisPresenceStore(process.env.REDIS_URL) : new MemoryPresenceStore();
}
