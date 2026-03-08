# TalonHub Backend Structure (Placeholder)

- Fastify services, plugin layout, route groups
- Auth handshake with agent skills
- Message bus + persistence adapters

> TODO: Keel to outline module tree, data models, queueing strategy.
## WebSocket Auth Flow (JWT+Refresh Tokens)
1. Client connects with API key
2. Server issues short-lived JWT (5m) + refresh token (7d)
3. JWT stored in WSS connection context
4. Refresh endpoint requires valid refresh token + IP pinning
