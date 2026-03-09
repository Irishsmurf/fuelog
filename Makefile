.PHONY: dev dev-frontend dev-api install test lint typecheck build clean kill-api-port

API_PORT ?= 3001

kill-api-port:
	@fuser -k $(API_PORT)/tcp 2>/dev/null || true

# Run frontend (Vite) and API (Vercel) concurrently
dev: kill-api-port
	@command -v vercel >/dev/null 2>&1 || { echo "vercel CLI not found — run: npm i -g vercel"; exit 1; }
	@command -v npx >/dev/null 2>&1 || { echo "npx not found"; exit 1; }
	npx concurrently --names "vite,api" --prefix-colors "cyan,magenta" \
		"npm run dev" \
		"vercel dev --listen $(API_PORT)"

# Run frontend only (no API functions)
dev-frontend:
	npm run dev

# Run API serverless functions only
dev-api: kill-api-port
	@command -v vercel >/dev/null 2>&1 || { echo "vercel CLI not found — run: npm i -g vercel"; exit 1; }
	vercel dev --listen $(API_PORT)

install:
	npm ci

test:
	npm run test

test-coverage:
	npm run test:coverage

lint:
	npm run lint

typecheck:
	npx tsc --noEmit

build:
	npm run build

# Run all checks (mirrors CI)
ci: lint typecheck test-coverage build

clean:
	rm -rf dist coverage
