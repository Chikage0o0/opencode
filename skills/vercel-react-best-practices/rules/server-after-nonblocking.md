---
title: Keep Post-Response Work Non-Blocking
impact: MEDIUM
impactDescription: faster response times
tags: server, async, logging, analytics, side-effects
---

## Keep Post-Response Work Non-Blocking

If your runtime supports background jobs or post-response hooks, use them for logging, analytics, and other side effects so they do not block the response.

**Incorrect (blocks response):**

```tsx
import { logUserAction } from '@/app/utils'

export async function POST(request: Request) {
  // Perform mutation
  await updateDatabase(request)
  
  // Logging blocks the response
  const userAgent = request.headers.get('user-agent') || 'unknown'
  await logUserAction({ userAgent })
  
  return new Response(JSON.stringify({ status: 'success' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

**Correct (non-blocking):**

```tsx
import { enqueueBackgroundTask } from '@/server/background-jobs'
import { logUserAction } from '@/app/utils'

export async function POST(request: Request) {
  // Perform mutation
  await updateDatabase(request)

  const userAgent = request.headers.get('user-agent') || 'unknown'
  const sessionId = request.headers.get('x-session-id') || 'anonymous'

  // Schedule work outside the critical response path
  enqueueBackgroundTask(async () => {
    await logUserAction({ sessionId, userAgent })
  })
  
  return new Response(JSON.stringify({ status: 'success' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

The response is sent immediately while logging happens in the background.

**Common use cases:**

- Analytics tracking
- Audit logging
- Sending notifications
- Cache invalidation
- Cleanup tasks

**Important notes:**

- Prefer durable queues for critical work such as billing, email, or audit trails
- Use the background primitive provided by your framework or hosting platform
