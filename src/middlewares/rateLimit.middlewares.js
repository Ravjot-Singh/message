import rateLimit from "express-rate-limit";

const generalLimiter = (options = {}) => {
  return  rateLimit({
        windowMs: options.windowMs || 60 * 1000,
        max: options.max || 10,
        message: options.message || 'Too many requests. Please try again later.',
    })
};


const socketLimiter = (limit, windowMs) => {
    const userBuckets = new Map();

    return (socket, next) => {
        const username = socket.data.username;
        if (!username) {
            return next(new Error('Unauthorized'));
        }

        const now = Date.now();
        const timestamps = userBuckets.get(username) || [];

        const recent = timestamps.filter(t => now - t < windowMs);

        if (recent.length >= limit) {
            return next(new Error('Rate limit exceede. Try again later.'));
        }

        recent.push(now);
        userBuckets.set(username, recent);

        next();

    };


}


export {generalLimiter , socketLimiter}