# gridflow Explorer frontend

The Vite + React + TypeScript app. Setup, the backend it reads from and how to run both
are in the root README: [Setup](../README.md#setup) and [Running](../README.md#running).

From this folder, with the backend running on port 8000:

```sh
npm install
npm run dev                  # http://localhost:5173, /api proxied to the backend
npm run build                # type-check (tsc -b), then the production build
npm run lint                 # oxlint
npm run shoot -- <route>     # light and dark screenshots of a route, in .shots/
```

`EXPLORER_API` points the proxy at a backend on another port, and `VITE_PORT` moves the
dev server. The design system is in [`DESIGN.md`](DESIGN.md), and the contract for
building a dataset page is in [`src/views/README.md`](src/views/README.md).
