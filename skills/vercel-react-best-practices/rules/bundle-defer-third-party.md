---
title: Defer Non-Critical Third-Party Libraries
impact: MEDIUM
impactDescription: loads after hydration
tags: bundle, third-party, analytics, defer
---

## Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them after hydration.

**Incorrect (blocks initial bundle):**

```tsx
import { Analytics } from '@vercel/analytics/react'

export function App({ children }) {
  return (
    <>
      {children}
      <Analytics />
    </>
  )
}
```

**Correct (loads after hydration):**

```tsx
import { useEffect, useState } from 'react'

export function App({ children }) {
  const [Analytics, setAnalytics] = useState<null | React.ComponentType>(null)

  useEffect(() => {
    let cancelled = false

    void import('@vercel/analytics/react').then(mod => {
      if (!cancelled) {
        setAnalytics(() => mod.Analytics)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {children}
      {Analytics ? <Analytics /> : null}
    </>
  )
}
```
