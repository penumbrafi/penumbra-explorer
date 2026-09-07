# Deploying the Penumbra explorer frontend

The build runs in GitHub Actions from `main` or a tag and is shipped to
CT1105 (`penumbra-web2`) over ssh. Nothing is built on the host.

| workflow | what it does |
| --- | --- |
| `.github/workflows/ci.yml` | lint, typecheck, stylelint and jest on PRs |
| `.github/workflows/deploy.yml` | build -> `penumbra-explorer-frontend-<sha>.tar.zst` -> release (tags) -> deploy |

## Release layout on the host

```
/opt/penumbra-explorer-frontend/
  releases/<git-sha>/     unpacked Next.js standalone bundle, contains BUILD_INFO
  current -> releases/<git-sha>
  shared/.env             host-owned runtime env, never touched by CI
```

Deploy is: rsync into `releases/<sha>`, flip `current` atomically, prune to
the five newest releases, `systemctl restart penumbra-explorer-frontend`,
smoke-test `http://127.0.0.1:3000/`. `rsync --delete` only runs inside the new
release directory, so `shared/` and every host `.env` survive untouched.

This replaces the in-place checkout at `/opt/penumbra-explorer` that was built
and started with `npm start`; the new path matches the unit name and keeps
`releases/` out of a git working tree.

## Transport

CT1105 has sshd but only an internal address (`10.6.78.85`), so Actions uses
`ProxyJump` through the bkk06 hypervisor into a forwarding-only account. See
`.github/actions/ssh-deploy`.

## Secrets and variables to create

GitHub **Environment** `production`, with these environment secrets:

| secret | value |
| --- | --- |
| `DEPLOY_SSH_KEY` | ed25519 private key for the deploy account |
| `DEPLOY_HOST` | public address of bkk06 (`160.22.180.6`) |
| `DEPLOY_CT` | CT1105 on the internal network (`10.6.78.85`) |
| `DEPLOY_KNOWN_HOSTS` | pinned host keys, below |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | base64 key; **must be identical** to the one in the host `shared/.env`, otherwise server actions fail after a deploy |

```
160.22.180.6 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMFjR7GW0By58m5FH+OBZ95VBB5ojplZa8C5UmjV731b
10.6.78.85 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBAWg1G4VempqSlmJtB+1XItpF7fHD8x+A3SBgJA0VQ1
```

Repository **variables** (not secret; all are inlined into the bundle at build
time, so changing one needs a rebuild, not a host edit). Unset variables fall
back to the values in `.env.penumbrafi`:

| variable | value while on rotko.net | value after the penumbra.fi cutover |
| --- | --- | --- |
| `BASE_URL` | `https://explorer.rotko.net` | `https://explorer.penumbra.fi` |
| `NEXT_PUBLIC_GRAPHQL_HOST` | `api.explorer.rotko.net` | `api.explorer.penumbra.fi` |
| `NEXT_PUBLIC_ENV_NAME` | `prod` | `prod` |
| `NEXT_PUBLIC_APP_VERSION` | `1.7.0` | `1.7.0` |
| `NO_INDEX` | `true` | `false` |
| `NEXT_PUBLIC_FATHOM_ID` | leave unset unless analytics is wanted | |

## One-time host setup

The jump account on bkk06 and the `web` account inside CT1105 are shared with
the other penumbrafi repos — set them up once, following
`penumbrafi/web`'s `deploy/README.md`. In addition, inside CT1105:

```sh
install -d -o web -g web /opt/penumbra-explorer-frontend/releases \
                         /opt/penumbra-explorer-frontend/shared

# carry the existing runtime env across unchanged (it holds the
# server-actions encryption key)
cp -a /opt/penumbra-explorer/.env /opt/penumbra-explorer-frontend/shared/.env
chown web:web /opt/penumbra-explorer-frontend/shared/.env
chmod 600 /opt/penumbra-explorer-frontend/shared/.env

install -m 644 deploy/systemd/penumbra-explorer-frontend.service /etc/systemd/system/
rm -rf /etc/systemd/system/penumbra-explorer-frontend.service.d  # drop-in folded in
systemctl daemon-reload
```

`rsync` and `zstd` must be installed in CT1105 (`apt-get install rsync zstd`);
neither is present by default.

The old `/opt/penumbra-explorer` checkout can be removed once the first CI
deploy is verified.

Then add the vhost from `deploy/nginx-penumbra.fi.conf.example` in CT1102.

## Known unverified

* GitHub-hosted runner reachability to bkk06 `:22` (the nftables ruleset
  accepts `tcp dport 22` from anywhere, but it has not been exercised from a
  runner).
* `npm run stylelint` / `npm test` have not been run in this environment; if
  either is broken on `main` today, drop that step from `ci.yml`.
