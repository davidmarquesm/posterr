# Posterr Backend Assessment

A high-performance RESTful API for the Posterr social media platform.
Designed to be scalable, production-ready, and easy to deploy using Docker.

## 🛠 Tech Stack

* **Runtime:** Node.js (v22-alpine)
* **Framework:** Fastify (Chosen for low overhead and high performance)
* **Database:** PostgreSQL 15
* **ORM:** Prisma (Type-safety and schema management)
* **Validation:** Zod
* **Testing:** Vitest (Integration tests)
* **Infrastructure:** Docker & Docker Compose

---

## 🚀 How to Run

### Prerequisites
* Docker & Docker Compose (v2+)
* Node.js (Optional, only for local tooling/tests)

### Step 1: Start the Environment
The application is fully containerized. The database migration will run automatically on startup.

```bash
docker compose up --build
```

Note: The API will be available at http://localhost:3000

### Step 2: Seed the Database
Since the database starts empty, you must run the seed script to populate it with 4 initial users and sample posts to test the features:

```bash
docker exec -it posterr-api npx prisma db seed
```
Output expectation: Seeding finished.

### Step 3: Run Automated Tests
This project includes integration tests that validate business logic (e.g., daily post limit) against a real database connection.

To run them, you first need to install local dependencies to get the test runner (Vitest):
```bash
npm install
npm test
```

### ⚠️ Troubleshooting / Development Notes
TypeScript & Prisma Client Sync
If you open the project in VS Code and see errors like Module '@prisma/client' has no exported member 'PostType', do not worry.

Reason: The migrations run inside the Docker container, so the Prisma Client generated inside Docker might be newer than your local node_modules used by your IDE.

Fix: Simply regenerate the local client to sync with your IDE:
```bash
npx prisma generate
```
Then, restart your TS Server (Ctrl+Shift+P -> "TypeScript: Restart TS Server") or VS Code.

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/posts` | Create a new post. Body: `{ username, type, content?, originalPostId? }`. Types: `ORIGINAL`, `REPOST`, `QUOTE`. |
| `GET` | `/posts` | List posts (Feed). Query Params: `page`, `filterByAuthor` (for "Only mine"), `startDate`, `endDate`. |
| `GET` | `/users/:username` | Get user profile data (Date joined and Post count). |





## 📝 Phase 2: Critique & Scaling Strategy

### Critique: What I would improve with more time
1.  **Cursor-Based Pagination:** Currently, I implemented Offset Pagination (`skip/take`) as it is simpler for a prototype. However, for datasets with millions of rows, this becomes slow because the DB still scans skipped rows. A cursor-based approach (using `created_at` or `id`) would be O(1) and much more performant.
2.  **Caching (Redis):** The User Profile endpoint counts posts (`count(*)`) on every request. This is computationally expensive. I would implement a Redis cache to store the `post_count` and increment it asynchronously when a new post is created.
3.  **Authentication:** Auth was skipped as per the assessment requirements. In a production scenario, I would implement **JWT** (JSON Web Tokens) via an API Gateway or Fastify plugins, ensuring the `user_id` is securely extracted from the token rather than trusting the request body.
4.  **Structured Logging & Observability:** While the current setup uses basic logging, for a production environment, I would enforce **Structured Logging** (JSON format, using libraries like Pino). This allows integration with centralized logging systems (ELK Stack, Datadog, CloudWatch) to easily query logs and trace requests using Correlation IDs.

### Scaling Strategy (The "1 Million Users" Scenario)

If Posterr grows significantly, the current monolithic architecture connected to a single Postgres instance would face bottlenecks. Here is the strategy to scale it:

#### 1. Database Scaling (Read/Write Split)
* **Bottleneck:** A single Postgres instance handling both heavy reads (feed generation) and writes (posting) will eventually lock up.
* **Solution:** Implement **Read Replicas**. All `GET` requests should be routed to a pool of read replicas, while only `POST` requests go to the Primary DB.
* **Sharding:** If the `posts` table exceeds huge sizes (TB range), we should shard the database by `user_id` or `created_at` (Time-partitioning).

#### 2. The "Fan-out" Problem (Feed Generation)
* **Bottleneck:** Querying the feed using SQL `JOIN`s (`WHERE author_id IN (followed_ids)`) becomes exponentially expensive as the follower count grows.
* **Solution:** Switch to a **Write-Model (Fan-out on Write)**. When a user posts, we asynchronously push the Post ID to a Redis list (a pre-computed "Timeline") for each of their followers. Reading the feed then becomes a simple O(1) fetch from Redis, removing the load from Postgres.

#### 3. Asynchronous Processing
* **Bottleneck:** The API hanging while saving posts or processing metadata guarantees high latency during traffic spikes.
* **Solution:** Use **AWS SQS/Kafka**. The API accepts the post, validates the schema, pushes it to a queue, and returns `202 Accepted` immediately. A background worker (Consumer) then saves it to Postgres and updates caches.

#### 4. Infrastructure
* **ECS/Kubernetes:** Scale the Node.js API stateless containers horizontally based on CPU/Memory usage using AWS Auto Scaling.