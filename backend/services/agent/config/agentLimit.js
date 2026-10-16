import redis from "../../../shared/redis/redis.js"

const Limit = {
    chat: 20,
    code: 5,
    search: 5,
    vision: 5,
    pdf: 5,
    ppt: 5,
}

export const checkLimit = async (userId, agent) => {
    const max = Limit[agent] || Limit["chat"]
    const key = `rate:${userId}:${agent}`
    const count = await redis.incr(key)
    if(count === 1){
        await redis.expire(key,60)
    }

    const ttl = await redis.ttl(key)

    if(count > max){
        const mins = Math.floor(ttl/60)
        const secs = (ttl%60)
        const time = mins > 0 ? `${mins}m : ${secs}s` : `${secs}s` 

        const error = new Error(`rate limit exceeded for ${agent}`)

        error.data = {
            success:false,
            agent,
            limit:max,
            remainingTime:ttl,
            retryAfter: time,
            message: `You have reached the ${agent} limit (${max} requests/minute). Try again in ${time}`
        }

        throw error
    }

    return {
        remaining: max - count,
        limit: max
    }
}