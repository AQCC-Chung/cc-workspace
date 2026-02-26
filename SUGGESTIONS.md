# Codebase Review and Suggestions

This document outlines 5 high-impact suggestions for improving the overall architecture, performance, and developer experience of the full-stack application. These suggestions are based on a review of the existing repository structure (FastAPI + React/Vite).

## 1. Backend Architecture Modernization (Modularization & ORM)

### Current Status
- The backend relies on raw SQLite queries (`sqlite3`) in `main.py` and `scraper.py`.
- Logic is mixed: API routes (`main.py`) directly handle database connections and some business logic.
- `scraper.py` is a large monolithic script handling scraping, parsing, and database insertion.

### Proposed Change
- **Adopt an ORM**: Use **SQLModel** (built on Pydantic & SQLAlchemy) to define database models. This provides type safety and eliminates raw SQL strings.
- **Layered Architecture**: separate concerns into:
    - **Routers**: Handle HTTP requests/responses (e.g., `routers/recommendations.py`).
    - **Services**: Business logic (e.g., `services/scraper_service.py`).
    - **Repositories (CRUD)**: Database interactions using the ORM.
- **Dependency Injection**: Use FastAPI's dependency injection system for database sessions.

### Benefits
- **Maintainability**: Easier to test and modify individual components without breaking others.
- **Type Safety**: Pydantic models ensure data consistency between the API and database.
- **Scalability**: Easier to swap the database (e.g., to PostgreSQL) later if needed.

## 2. Frontend Type Safety & Modernization (Full TypeScript Migration)

### Current Status
- The project has `tsconfig.json` and TypeScript installed, but many files are still `.jsx` (e.g., `App.jsx`, `main.jsx`, `TasteMap.jsx`).
- Props validation is loose or missing, relying on runtime checks.

### Proposed Change
- **Convert to `.tsx`**: Rename and refactor all `.jsx` files to `.tsx`.
- **Define Interfaces**: Create shared TypeScript interfaces for API responses (e.g., `Recommendation`, `ScrapeResult`) that mirror the backend Pydantic models.
- **Strict Mode**: Enable stricter TypeScript checks in `tsconfig.json` to catch potential bugs at compile time.

### Benefits
- **Robustness**: Catch type-related errors during development rather than at runtime.
- **Developer Experience**: Better IDE autocompletion and documentation through types.
- **Consistency**: Unified type system across frontend and backend.

## 3. Asynchronous Scraper & Background Tasks

### Current Status
- The `scraper.py` uses the synchronous `requests` library.
- The `/api/search` endpoint calls `scraper.scrape_data` directly, which performs multiple blocking network calls (DuckDuckGo, Google Places). This can lead to timeouts or block the server thread pool.

### Proposed Change
- **Async I/O**: Refactor the scraper to use **`httpx`** or **`aiohttp`** with `async/await` to perform network requests concurrently.
- **Background Processing**:
    - For long-running scrapes, offload the work to a background task (using FastAPI `BackgroundTasks` or a task queue like Celery/Redis).
    - The API should return a "job ID" or status immediately, and the frontend can poll for results or use WebSockets.

### Benefits
- **Performance**: Drastically reduces the time to fetch data by running requests in parallel.
- **Responsiveness**: Prevents the API server from becoming unresponsive during heavy scraping operations.
- **User Experience**: Users get immediate feedback instead of a hanging request.

## 4. Advanced Data Fetching & State Management (TanStack Query)

### Current Status
- Data fetching in `TasteMap.jsx` uses `useEffect` and raw `fetch`.
- Loading, error, and pagination states are managed manually with `useState`.
- Caching is not implemented (re-fetching happens on component mount).

### Proposed Change
- **Integrate TanStack Query (React Query)**: Replace manual `fetch` logic with `useQuery` and `useInfiniteQuery`.
- **Features**:
    - **Caching**: Automatically cache search results to avoid redundant API calls.
    - **Infinite Scroll**: Simplifies "Load More" implementation.
    - **Background Updates**: Keeps data fresh without manual intervention.

### Benefits
- **Code Reduction**: Eliminates boilerplate code for loading/error states.
- **Performance**: optimized caching and deduping of requests.
- **UX**: Smoother transitions and instant data availability for previously visited queries.

## 5. Infrastructure & Developer Experience (Docker & Linting)

### Current Status
- The project runs with `npm run dev` and `uvicorn` separately.
- Dependencies are managed via `package.json` and `requirements.txt`.
- No consistent linting/formatting configuration visible for Python (e.g., generic `flake8` or `black`).

### Proposed Change
- **Dockerization**: Create a `Dockerfile` (or multi-stage build) and `docker-compose.yml` to spin up the entire stack (Frontend + Backend + DB) with a single command.
- **Linting & Formatting**:
    - **Frontend**: Enforce ESLint + Prettier.
    - **Backend**: Adopt **Ruff** (fast Python linter/formatter) to ensure code quality.
    - **Pre-commit Hooks**: Use `husky` or `pre-commit` to run checks before committing.

### Benefits
- **Reproducibility**: "Works on my machine" issues are eliminated.
- **Deployment**: Easier to deploy to platforms like Render, AWS, or DigitalOcean.
- **Code Quality**: Consistent style and automatic error catching across the team.
