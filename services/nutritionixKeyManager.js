const logger = require('../utils/logger');
const config = require('../config');

class NutritionixKeyManager {
    constructor() {
        this.keys = [
            { appId: process.env.NUTRITIONIX_APP_ID_1, appKey: process.env.NUTRITIONIX_APP_KEY_1, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_2, appKey: process.env.NUTRITIONIX_APP_KEY_2, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_3, appKey: process.env.NUTRITIONIX_APP_KEY_3, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_4, appKey: process.env.NUTRITIONIX_APP_KEY_4, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_5, appKey: process.env.NUTRITIONIX_APP_KEY_5, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_6, appKey: process.env.NUTRITIONIX_APP_KEY_6, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_7, appKey: process.env.NUTRITIONIX_APP_KEY_7, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_8, appKey: process.env.NUTRITIONIX_APP_KEY_8, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_9, appKey: process.env.NUTRITIONIX_APP_KEY_9, requestCount: 0, lastReset: new Date() },
            { appId: process.env.NUTRITIONIX_APP_ID_10, appKey: process.env.NUTRITIONIX_APP_KEY_10, requestCount: 0, lastReset: new Date() }
        ];
        
        this.currentKeyIndex = 0;
        this.dailyLimit = 200;
        this.resetInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        // Start the reset interval
        setInterval(() => this.resetCounts(), this.resetInterval);
        
        logger.info('NutritionixKeyManager initialized with', { keyCount: this.keys.length });
    }

    resetCounts() {
        const now = new Date();
        this.keys.forEach(key => {
            if (now - key.lastReset >= this.resetInterval) {
                key.requestCount = 0;
                key.lastReset = now;
                logger.info('Reset request count for key:', { 
                    appId: key.appId.substring(0, 4) + '...',
                    lastReset: key.lastReset
                });
            }
        });
    }

    getNextKey() {
        const startIndex = this.currentKeyIndex;
        
        do {
            const key = this.keys[this.currentKeyIndex];
            
            // Check if this key has reached its daily limit
            if (key.requestCount < this.dailyLimit) {
                key.requestCount++;
                logger.debug('Using Nutritionix key:', { 
                    appId: key.appId.substring(0, 4) + '...',
                    requestCount: key.requestCount,
                    remaining: this.dailyLimit - key.requestCount
                });
                return key;
            }
            
            // Move to next key
            this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
            
            // If we've checked all keys and none are available
            if (this.currentKeyIndex === startIndex) {
                logger.error('All Nutritionix API keys have reached their daily limit');
                throw new Error('All Nutritionix API keys have reached their daily limit');
            }
        } while (true);
    }

    markKeyAsExhausted(appId) {
        const key = this.keys.find(k => k.appId === appId);
        if (key) {
            key.requestCount = this.dailyLimit;
            logger.warn('Marked Nutritionix key as exhausted:', { 
                appId: appId.substring(0, 4) + '...'
            });
        }
    }

    getAvailableKeysCount() {
        return this.keys.filter(key => key.requestCount < this.dailyLimit).length;
    }

    getTotalRequestsToday() {
        return this.keys.reduce((total, key) => total + key.requestCount, 0);
    }
}

module.exports = new NutritionixKeyManager(); 