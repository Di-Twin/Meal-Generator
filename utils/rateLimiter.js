class RateLimiter {
    constructor(maxCalls, timeWindow) {
        this.maxCalls = maxCalls; // Maximum calls allowed in the time window
        this.timeWindow = timeWindow; // Time window in milliseconds
        this.calls = []; // Array to store timestamps of API calls
    }

    async checkLimit() {
        const now = Date.now();
        
        // Remove calls outside the time window
        this.calls = this.calls.filter(timestamp => now - timestamp < this.timeWindow);
        
        if (this.calls.length >= this.maxCalls) {
            const oldestCall = this.calls[0];
            const waitTime = this.timeWindow - (now - oldestCall);
            throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
        }
        
        this.calls.push(now);
        return true;
    }

    getRemainingCalls() {
        const now = Date.now();
        this.calls = this.calls.filter(timestamp => now - timestamp < this.timeWindow);
        return this.maxCalls - this.calls.length;
    }
}

// Create a singleton instance for FatSecret API
const fatSecretLimiter = new RateLimiter(48000, 24 * 60 * 60 * 1000); // 4500 calls per day (leaving buffer)

module.exports = fatSecretLimiter; 