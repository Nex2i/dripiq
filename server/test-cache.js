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
        
        console.log('Redis connection created, status:', redis.status);
        
        // Wait for connection to be ready
        if (redis.status !== 'ready') {
            console.log('Waiting for Redis connection...');
            await new Promise((resolve, reject) => {
                redis.once('ready', resolve);
                redis.once('error', reject);
                setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
            });
        }
        
        console.log('Redis connection status:', redis.status);
        
        // Test basic Redis operations
        console.log('Testing basic Redis operations...');
        await redis.set('test:basic', 'hello');
        const basicResult = await redis.get('test:basic');
        console.log('Basic Redis test:', basicResult === 'hello' ? 'PASS' : 'FAIL');
        
        // Check all keys before our test
        const keysBefore = await redis.keys('*');
        console.log('Keys in Redis before test:', keysBefore.length);
        
        // Test 1: KeyvRedis with ioredis instance
        console.log('\n=== Test 1: KeyvRedis with ioredis instance ===');
        try {
            const keyvRedis = new KeyvRedis(redis, {
                namespace: 'dripiq',
            });
            
            const keyv1 = new Keyv({
                store: keyvRedis,
                ttl: 3600 * 1000,
            });
            
            const testKey1 = 'test1:' + Date.now();
            const testValue1 = { message: 'Hello from Keyv1', timestamp: Date.now() };
            
            console.log('Setting value with KeyvRedis...');
            await keyv1.set(testKey1, testValue1, 30000);
            
            console.log('Getting value with KeyvRedis...');
            const retrieved1 = await keyv1.get(testKey1);
            
            console.log('Retrieved value:', retrieved1);
            console.log('Test 1 result:', retrieved1 && retrieved1.message === testValue1.message ? 'PASS' : 'FAIL');
            
        } catch (error) {
            console.error('Test 1 failed:', error.message);
        }
        
        // Test 2: KeyvRedis with connection string
        console.log('\n=== Test 2: KeyvRedis with connection string ===');
        try {
            const keyv2 = new Keyv({
                store: new KeyvRedis(redisUrl, {
                    namespace: 'dripiq',
                }),
                ttl: 3600 * 1000,
            });
            
            const testKey2 = 'test2:' + Date.now();
            const testValue2 = { message: 'Hello from Keyv2', timestamp: Date.now() };
            
            console.log('Setting value with connection string...');
            await keyv2.set(testKey2, testValue2, 30000);
            
            console.log('Getting value with connection string...');
            const retrieved2 = await keyv2.get(testKey2);
            
            console.log('Retrieved value:', retrieved2);
            console.log('Test 2 result:', retrieved2 && retrieved2.message === testValue2.message ? 'PASS' : 'FAIL');
            
        } catch (error) {
            console.error('Test 2 failed:', error.message);
        }
        
        // Test 3: Direct Keyv with Redis URI
        console.log('\n=== Test 3: Direct Keyv with Redis URI ===');
        try {
            const keyv3 = new Keyv(redisUrl, {
                namespace: 'dripiq',
                ttl: 3600 * 1000,
            });
            
            const testKey3 = 'test3:' + Date.now();
            const testValue3 = { message: 'Hello from Keyv3', timestamp: Date.now() };
            
            console.log('Setting value with direct Keyv...');
            await keyv3.set(testKey3, testValue3, 30000);
            
            console.log('Getting value with direct Keyv...');
            const retrieved3 = await keyv3.get(testKey3);
            
            console.log('Retrieved value:', retrieved3);
            console.log('Test 3 result:', retrieved3 && retrieved3.message === testValue3.message ? 'PASS' : 'FAIL');
            
        } catch (error) {
            console.error('Test 3 failed:', error.message);
        }
        
        // Check what keys exist now
        console.log('\n=== Redis Key Inspection ===');
        const allKeys = await redis.keys('*');
        console.log('All keys in Redis:', allKeys);
        
        const dripiqKeys = await redis.keys('dripiq:*');
        console.log('Keys with dripiq namespace:', dripiqKeys);
        
        const testKeys = await redis.keys('*test*');
        console.log('Keys containing "test":', testKeys);
        
        // Try to get values directly from Redis
        if (allKeys.length > 0) {
            console.log('\nDirect Redis values:');
            for (const key of allKeys.slice(0, 5)) { // Limit to first 5
                try {
                    const value = await redis.get(key);
                    console.log(`${key}: ${value}`);
                } catch (err) {
                    console.log(`${key}: [error getting value]`);
                }
            }
        }
        
        // Clean up
        await redis.del('test:basic');
        await redis.quit();
        
        console.log('\nCache test completed!');
        
    } catch (error) {
        console.error('Cache test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testCache();