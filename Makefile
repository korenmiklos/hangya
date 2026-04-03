PATH := /opt/homebrew/bin:$(PATH)

.PHONY: dev build preview clean install

install:
	npm install

dev:
	npx vite

build:
	npx tsc -b && npx vite build

preview: build
	npx vite preview

clean:
	rm -rf dist node_modules
