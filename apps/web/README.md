# ZunDB Web

Next.js App Router frontend for the ZunDB control plane.

## Run

```bash
npm install
npm run dev
```

The frontend calls `NEXT_PUBLIC_API_BASE_URL` (default `/api`) and sends cookies with every request. The API should expose the resource paths used in `app/` and return `401` from `/auth/me` when no session is active.
