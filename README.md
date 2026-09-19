# penumbra-explorer

![Status](https://github.com/pk-labs/pe-frontend/actions/workflows/gcp.yaml/badge.svg)
![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fgist.githubusercontent.com%2Fstpch%2F9208254a7b67b695d104a875931624d8%2Fraw%2Fpe-frontend-lcov-coverage.json&label=Coverage)

Penumbra Blockchain Explorer

## Getting started

1. Set up Node.js v22
2. Install dependencies with  `npm install`
3. Start the app with `npm run dev`

### npm scripts

| Script                    | Description                                           |
|---------------------------|-------------------------------------------------------|
| `npm run dev`             | Run app in development environment.                   |
| `npm run graphql:codegen` | Generates types and hooks in `lib/graphql/generated`. |
| `npm test`                | Run tests.                                            |
| `npm run test:coverage`   | Run with coverage report to console and file.         |
| `npm run test:watch`      | Run tests in watch mode.                              |
| `npm run lint`            | Lint JavaScript with ESLint.                          |
| `npm run lint:fix`        | Lint and fix JavaScript with ESLint.                  |
| `npm run stylelint`       | Lint CSS with Stylelint.                              |
| `npm run stylelint:fix`   | Fix and fix CSS with Stylelint.                       |
| `npm run typecheck`       | Check TypeScript code.                                |
| `npm run build`           | Build app for deployment.                             |
| `npm run clean`           | Removes build artifacts.                              |
| `npm start`               | Run app in deployment mode.                           |

### Project structure

| Directory           | Description                                                                                                                                                                                                    |
|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/app`           | Next.js app router with layouts and pages.                                                                                                                                                                     |
| `src/components`    | Presentational components with little logic.                                                                                                                                                                   |
| `src/containers`    | Container components that perform data fetching or have logic other<br/>than presentational. Server components use React Suspense to show<br/>loading skeletons until Next.js finishes streaming fetched data. |
| `src/lib/`          | App-wide configuration, types, helpers, assets, etc.                                                                                                                                                           |
| `src/lib/__tests__` | Global test configuration.                                                                                                                                                                                     |
| `src/lib/css`       | Tailwind CSS configuration and theme.                                                                                                                                                                          |
| `src/lib/data`      | Data fetchers and transformers.                                                                                                                                                                                |
| `src/lib/fonts`     | Custom fonts loaded and optimized with next/font.                                                                                                                                                              |
| `src/lib/graphql`   | GraphQL client with schema, queries, generated code, etc.                                                                                                                                                      |
| `src/lib/hooks`     | Custom React hooks.                                                                                                                                                                                            |
| `src/lib/images`    | Image assets that are directly imported.                                                                                                                                                                       |
| `src/lib/utils`     | Utility functions for formatting, transforming, etc.                                                                                                                                                           |
| `public`            | Static public assets directly accessible through the browser.                                                                                                                                                  |
| `docker`            | Docker configuration to run as container.                                                                                                                                                                      |

## GraphQL

GraphQL code such as queries and fragments is located in `sc/lib/graphql` and
uses the [urql](https://commerce.nearform.com/open-source/urql/) client to
connect to the backend. `scr/lib/graphql/generated` contains types, hooks, etc.
generated using `npm run graphql:codegen`.

## CSS, icons and fonts

The project uses [Tailwind CSS](https://tailwindcss.com/) with the global CSS
and theme at `src/lib/css`. It replicates the
[@penumbra-zone/ui](https://github.com/penumbra-zone/web/tree/main/packages/ui)
Tailwind v3 configuration in v4 and uses their components where possible.

Some components have custom styles (e.g. animations) collocated as CSS module.

https://lucide.dev/ is used for most icons. Some are custom and exported from
Figma.

The `Poppins` and `Work Sans` fonts are loaded with `next/font/google` whereas
`Iosevka` is built from source and loaded with `next/font/local` from
`src/lib/fonts`.

## Linting

TypeScript is linted and autoformatted with ESLint and Prettier. CSS is linted
and autoformatted with Stylelint.

## Testing

Jest tests are collocated with the tested files. Global test configuration and
mocks reside in `src/lib/__tests__`. Test coverage can be reported to console
and written to file with `npm run test:coverage`.

## Environments

One environment, `production`, hosted in CT1105 (`penumbra-web2`) behind the
nginx in CT1102:

- https://explorer.penumbra.fi (alias https://explorer.rotko.net)

## CI/CD

`.github/workflows/deploy.yml` builds the app on every push to `main` and on
tags, packs the Next.js standalone bundle as
`penumbra-explorer-frontend-<sha>.tar.zst`, uploads it as a workflow artifact
(and attaches it to the GitHub release on tags), then rsyncs it to
`/opt/penumbra-explorer-frontend/releases/<sha>` on the host, flips the
`current` symlink and restarts `penumbra-explorer-frontend.service`.

Nothing is built on the server. `.github/workflows/ci.yml` runs lint,
typecheck, stylelint and jest on pull requests.

See `deploy/README.md` for the secrets, the systemd unit and the one-time host
setup.

## Docker

The project can also be run as a Docker container in production mode. Each
environment has its own configuration located in the `docker` folder.
Only the `dev` configuration is kept; production runs from the standalone
bundle described above, not from a container.

Build and run it using the following commands:

```
docker compose -f docker/dev/compose.yaml build
docker compose -f docker/dev/compose.yaml up
```

## Misc

- https://zustand.docs.pmnd.rs/ for client-side state management
- https://day.js.org/ for date manipulation and formatting
- https://motion.dev/ for animations such as dashboard number count-up
- https://github.com/lukeed/clsx for conditional `className` construction
- https://github.com/dcastil/tailwind-merge for merging Tailwind classes
- https://usefathom.com/ for production page view analytics
