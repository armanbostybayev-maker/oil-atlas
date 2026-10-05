# AIS service

```sh
# Set AISSTREAM_API_KEY in the server environment first.
npm run ais
```

Node does not automatically read `.env.local`; inject server environment variables through your shell or hosting configuration. Never expose AIS credentials through `VITE_` variables. Development Vite proxies `/api/tankers` to `127.0.0.1:8787/tankers`. The production serverless proxy uses `AIS_BACKEND_URL` (defaults to the existing Render service). Deploy the updated collector as well as the frontend/proxy to obtain full stream health metadata.

Frontend polling is sequential: the next request starts 10 seconds after the previous finishes. Browser timeout is 8 seconds; the production proxy times out upstream at 6 seconds. On unmount the request and timers are cancelled. The last known vessels remain visible on failure with a stale label; an initial failure shows offline. The UI displays the last successful API response and the last received position time. A fresh HTTP response alone never means fresh AIS data. Older backend responses without `stream` metadata use the newest vessel `receivedAt` / timestamp; an empty response without freshness metadata is not labelled live.

The collector's `stream` metadata is included in `/tankers` and passed through the proxy. `/health` retains `ok`, `vessels`, `staticRecords`, `tankers`, `timestamp` and adds `connected`, `lastMessageAt`, `lastPositionAt`, `ageSeconds`, `positionAgeSeconds`, `vesselCount`, `staleAfterSeconds`. HTTP is 200 when healthy, **503 when disconnected, not yet receiving positions, or stale**. Freshness means reception time at the collector. Subscription confirmations and error messages do not refresh stream health.

Default freshness threshold is 60 seconds, configurable on the server as `AIS_STREAM_STALE_MS`. The browser independently caps acceptable position age at 60 seconds. Cleanup runs every 60 seconds independently of HTTP requests. Positions expire after 30 minutes; static entries expire after 30 minutes without either static updates or a live position for that MMSI. Static metadata is retained for actively reporting vessels. Position history stays capped at 120 points. Close reconnects after 5 seconds; errors terminate the socket to trigger reconnect. Shutdown cancels cleanup/reconnect timers, terminates the socket and closes HTTP connections.

`createCollector` supports injected clock/socket/intervals for local tests. `npm test` checks HTTP health status, disconnected/stale states, TTL cleanup without requests, polling timeout, retained positions and lifecycle cleanup with a fake WebSocket. These checks do not verify AISStream coverage or hosting availability.
