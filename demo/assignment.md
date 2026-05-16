# CS 493 — Assignment 3: Businesses REST API

**Course:** CS 493 — Cloud Application Development
**Due:** End of Week 5, 11:59 PM PT
**Points:** 100

## Overview

In this assignment you will design and implement a small RESTful API for managing **businesses**. Each business has a `name` and an `address`, and is identified by a numeric `id`. Your API must support creating, listing (with pagination), fetching by id, and deleting businesses. The API will be evaluated against an automated test suite that hits a running instance of your server.

This assignment is intentionally lightweight on persistence so you can focus on HTTP semantics, request validation, and pagination. You may store data in-memory for this assignment.

## Learning Objectives

By the end of this assignment, you should be able to:

- Implement CRUD endpoints that follow REST conventions.
- Return appropriate HTTP status codes for success and error cases.
- Validate incoming request bodies and reject malformed payloads.
- Implement page-based pagination with a `next` link.

## Requirements

Your server must listen on **port 3000** and expose the following routes:

### 1. `POST /businesses`

- Accepts a JSON body with `name` (string) and `address` (string).
- Returns **201 Created** with a JSON body `{ "id", "name", "address" }`.
- Returns **400 Bad Request** if the body is missing, not JSON, or any required field is missing or not a non-empty string.

### 2. `GET /businesses?page=<n>&limit=<n>`

- Returns **200 OK** with `{ "businesses": [...], "next": "?page=<n+1>&limit=<n>" | null, "total": <int> }`.
- `next` must be `null` on the last page.
- Defaults: `page=1`, `limit=3`.

### 3. `GET /businesses/:id`

- Returns **200 OK** with `{ "id", "name", "address" }`.
- Returns **404 Not Found** if no business has that id.

### 4. `DELETE /businesses/:id`

- Returns **204 No Content** on success.
- Returns **404 Not Found** if no business has that id.
- Subsequent `GET /businesses/:id` must return 404.

## Submission

Submit a link to your GitHub repository containing your server code, a `Dockerfile`, and a `README.md` with instructions for running locally. Your graders will spin up your server and run an automated Postman collection against it.

## Rubric

| # | Criterion | Points |
|---|-----------|--------|
| 1 | `POST /businesses` creates and returns **201** with the correct shape | 15 |
| 2 | `GET /businesses` paginated correctly with `next` and `total` | 20 |
| 3 | `GET /businesses/:id` returns correct shape | 15 |
| 4 | `DELETE` works and resource is gone afterwards | 15 |
| 5 | Proper **404** on missing resource | 15 |
| 6 | Proper **400** on invalid POST body | 20 |
| | **Total** | **100** |
