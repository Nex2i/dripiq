// Simple cache test script for ioredis-based cache
// Run with: node test-cache.js

const IORedis = require('ioredis');

async function testCache() {
    console.log('Testing direct ioredis cache...');
    
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
        
        // Test cache-like operations with JSON serialization
        console.log('\n=== Test: Direct ioredis with JSON ===');
        
        const namespace = 'dripiq';
        const buildKey = (key) => `${namespace}:${key}`;
        
        // Test 1: Basic set/get with JSON
        const testKey1 = buildKey('test1:' + Date.now());
        const testValue1 = { message: 'Hello from ioredis', timestamp: Date.now() };
        const serialized1 = JSON.stringify(testValue1);
        
        console.log('Setting JSON value with SETEX...');
        await redis.setex(testKey1, 30, serialized1); // 30 seconds TTL
        
        console.log('Getting JSON value...');
        const retrieved1 = await redis.get(testKey1);
        const parsed1 = retrieved1 ? JSON.parse(retrieved1) : null;
        
        console.log('Retrieved value:', parsed1);
        console.log('JSON test result:', parsed1 && parsed1.message === testValue1.message ? 'PASS' : 'FAIL');
        
        // Test 2: Check TTL
        const ttl = await redis.ttl(testKey1);
        console.log('TTL test:', ttl > 0 && ttl <= 30 ? 'PASS' : 'FAIL', `(TTL: ${ttl})`);
        
        // Test 3: EXISTS check
        const exists = await redis.exists(testKey1);
        console.log('EXISTS test:', exists === 1 ? 'PASS' : 'FAIL');
        
        // Test 4: Multiple values
        const testKey2 = buildKey('test2:' + Date.now());
        const testValue2 = { type: 'user', id: 123, active: true };
        await redis.setex(testKey2, 60, JSON.stringify(testValue2));
        
        // Check what keys exist now
        console.log('\n=== Redis Key Inspection ===');
        const allKeys = await redis.keys('*');
        console.log('All keys in Redis:', allKeys);
        
        const dripiqKeys = await redis.keys('dripiq:*');
        console.log('Keys with dripiq namespace:', dripiqKeys);
        
        // Try to get values directly from Redis
        if (dripiqKeys.length > 0) {
            console.log('\nDripiq namespace values:');
            for (const key of dripiqKeys) {
                try {
                    const value = await redis.get(key);
                    const parsed = JSON.parse(value);
                    console.log(`${key}: ${JSON.stringify(parsed)}`);
                } catch (err) {
                    console.log(`${key}: [error parsing JSON: ${value}]`);
                }
            }
        }
        
        // Test cleanup
        await redis.del(testKey1, testKey2);
        await redis.del('test:basic');
        
        console.log('\n=== Final Key Check ===');
        const finalKeys = await redis.keys('dripiq:*');
        console.log('Remaining dripiq keys after cleanup:', finalKeys);
        
        await redis.quit();
        
        console.log('\nDirect ioredis cache test completed successfully!');
        
    } catch (error) {
        console.error('Cache test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testCache();