---
title: Authenticate Server Mutations Like Public Endpoints
impact: CRITICAL
impactDescription: prevents unauthorized access to server mutations
tags: server, mutations, authentication, security, authorization
---

## Authenticate Server Mutations Like Public Endpoints

**Impact: CRITICAL (prevents unauthorized access to server mutations)**

Any server-side mutation endpoint can be invoked directly. Always verify authentication and authorization **inside** the mutation handler—do not rely solely on middleware, route guards, or UI-level checks.

**Incorrect (no authentication check):**

```typescript
export async function deleteUserHandler(request: Request) {
  const { userId } = await request.json()

  // Anyone who can hit this endpoint can trigger it
  await db.user.delete({ where: { id: userId } })
  return Response.json({ success: true })
}
```

**Correct (authentication inside the action):**

```typescript
import { verifySession } from '@/lib/auth'
import { unauthorized } from '@/lib/errors'

export async function deleteUserHandler(request: Request) {
  const { userId } = await request.json()

  // Always check auth inside the handler
  const session = await verifySession(request)
  
  if (!session) {
    throw unauthorized('Must be logged in')
  }
  
  // Check authorization too
  if (session.user.role !== 'admin' && session.user.id !== userId) {
    throw unauthorized('Cannot delete other users')
  }
  
  await db.user.delete({ where: { id: userId } })
  return Response.json({ success: true })
}
```

**With input validation:**

```typescript
import { verifySession } from '@/lib/auth'
import { z } from 'zod'

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email()
})

export async function updateProfileHandler(request: Request) {
  const payload = await request.json()

  // Validate input first
  const validated = updateProfileSchema.parse(payload)
  
  // Then authenticate
  const session = await verifySession(request)
  if (!session) {
    throw new Error('Unauthorized')
  }
  
  // Then authorize
  if (session.user.id !== validated.userId) {
    throw new Error('Can only update own profile')
  }
  
  // Finally perform the mutation
  await db.user.update({
    where: { id: validated.userId },
    data: {
      name: validated.name,
      email: validated.email
    }
  })
  
  return Response.json({ success: true })
}
```
