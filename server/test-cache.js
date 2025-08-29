// Simple cache test script
// Run with: node test-cache.js

const { Keyv } = require('keyv');
const KeyvRedis = require('@keyv/redis');
const IORedis = require('ioredis');

async function testCache() {
    console.log('Testing cache connection...');
    
    try {
        // Get Redis URL from environment
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            console.error('REDIS_URL environment variable is required');
            process.exit(1);
        }
        
        console.log('Redis URL:', redisUrl);
        
        // Create Redis connection (same as BullMQ would)
        const redis = new IORedis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            lazyConnect: false,
        });
        
        console.log('Redis connection created');
        
        // Test basic Redis operations
        await redis.set('test:basic', 'hello');
        const basicResult = await redis.get('test:basic');
        console.log('Basic Redis test:', basicResult === 'hello' ? 'PASS' : 'FAIL');
        
        // Create KeyvRedis store
        const keyvRedis = new KeyvRedis(redis, {
            namespace: 'dripiq',
        });
        
        console.log('KeyvRedis store created');
        
        // Create Keyv instance
        const keyv = new Keyv({
            store: keyvRedis,
            ttl: 3600 * 1000, // 1 hour default
        });
        
        console.log('Keyv instance created');
        
        // Test Keyv operations
        const testKey = 'test:keyv:' + Date.now();
        const testValue = { message: 'Hello from Keyv', timestamp: Date.now() };
        
        console.log('Setting test value...');
        await keyv.set(testKey, testValue, 30000); // 30 seconds TTL
        
        console.log('Getting test value...');
        const retrieved = await keyv.get(testKey);
        
        console.log('Test value:', retrieved);
        console.log('Keyv test:', retrieved && retrieved.message === testValue.message ? 'PASS' : 'FAIL');
        
        // Check if value exists in Redis directly
        const redisKeys = await redis.keys('dripiq:*');
        console.log('Redis keys matching dripiq:*:', redisKeys);
        
        // Clean up
        await keyv.delete(testKey);
        await redis.del('test:basic');
        await redis.quit();
        
        console.log('Cache test completed successfully!');
        
    } catch (error) {
        console.error('Cache test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testCache();