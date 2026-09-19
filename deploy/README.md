# Deploying the Penumbra explorer frontend

The build runs in GitHub Actions from `main` or a tag and is shipped to
CT1199 (`penumbra-web2`) over ssh. Nothing is built on the host.

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

CT1199 has sshd but only an internal address (`10.7.78.85`), so Actions uses
`ProxyJump` through the bkk07 hypervisor into a forwarding-only account. See
`.github/actions/ssh-deploy`.

## Secrets and variables to create

GitHub **Environment** `production` (only the `deploy` job runs in it), with
these environment secrets:

| secret | value |
| --- | --- |
| `DEPLOY_SSH_KEY` | ed25519 private key for the deploy account |
| `DEPLOY_HOST` | public address of bkk07 (`160.22.180.7`) |
| `DEPLOY_CT` | CT1199 on the internal network (`10.7.78.85`) |
| `DEPLOY_KNOWN_HOSTS` | pinned host keys, both lines below |

**Repository** secret (the `build` job is not in an environment, so an
environment secret would silently expand to the empty string there):

| secret | value |
| --- | --- |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | base64 key; **must be identical** to the one in the host `shared/.env`, otherwise server actions fail after a deploy |

```
160.22.180.7 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP6SkALaJpxjUVzmxrzWbq3pDNICOdZeyRNOXMWQHA/D
10.7.78.85 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBAWg1G4VempqSlmJtB+1XItpF7fHD8x+A3SBgJA0VQ1
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

### bkk07 — forwarding-only jump account

`ssh-deploy` reaches the container with `ProxyJump`, i.e. an `ssh -W` direct
TCP forward. The jump account therefore needs no shell, no sudo and no
`pct` privileges — only permission to open one TCP channel to `10.7.78.85:22`.

```sh
useradd -m -s /usr/sbin/nologin deploy-jump
ssh-keygen -t ed25519 -N '' -C deploy@penumbra-explorer \
           -f /root/deploy-keys/penumbra-explorer

install -d -m 700 -o deploy-jump -g deploy-jump /home/deploy-jump/.ssh
printf 'restrict,port-forwarding,permitopen="10.7.78.85:22" %s\n' \
    "$(cat /root/deploy-keys/penumbra-explorer.pub)" \
    > /home/deploy-jump/.ssh/authorized_keys
chown deploy-jump:deploy-jump /home/deploy-jump/.ssh/authorized_keys
chmod 600 /home/deploy-jump/.ssh/authorized_keys

cat > /etc/ssh/sshd_config.d/10-deploy-jump.conf <<'CFG'
Match User deploy-jump
    AllowTcpForwarding local
    PermitOpen 10.7.78.85:22
    PermitTTY no
    X11Forwarding no
    AllowAgentForwarding no
    ForceCommand /usr/sbin/nologin
CFG
sshd -t && systemctl reload ssh
```

A `from=` restriction is not usable: GitHub-hosted runners have no stable
source addresses. The account is confined by `permitopen`/`PermitOpen`
instead — it can reach exactly one host and port and nothing else.

### CT1199 — `web` account, release layout and unit

The private key above is used for both hops, so the same public key goes into
the container:

```sh
pct exec 1199 -- install -d -m 700 -o web -g web /home/web/.ssh
pct push 1199 /root/deploy-keys/penumbra-explorer.pub \
    /home/web/.ssh/authorized_keys --user 1000 --group 1000 --perms 600

pct exec 1199 -- apt-get install -y rsync zstd   # neither is present by default

pct exec 1199 -- install -d -o web -g web \
    /opt/penumbra-explorer-frontend/releases /opt/penumbra-explorer-frontend/shared
```

`shared/.env` is host-owned and never touched by CI. Carry the values across
from the old in-place checkout, but **generate a fresh**
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`) and set the
identical value as the repository secret — the build inlines it and the
runtime reads it from this file, so the two must match:

```sh
pct exec 1199 -- chown web:web /opt/penumbra-explorer-frontend/shared/.env
pct exec 1199 -- chmod 600 /opt/penumbra-explorer-frontend/shared/.env
```

The `activate` step runs `sudo /usr/bin/systemctl restart` as `web`, which
needs exactly one sudoers rule and nothing wider:

```sh
pct exec 1199 -- tee /etc/sudoers.d/penumbra-explorer-deploy <<'SUDO'
web ALL=(root) NOPASSWD: /usr/bin/systemctl restart penumbra-explorer-frontend.service
SUDO
pct exec 1199 -- visudo -cf /etc/sudoers.d/penumbra-explorer-deploy
```

Finally the unit. It keeps the name the in-place deployment used, so the first
CI `activate` restarts straight into the standalone bundle:

```sh
install -m 644 deploy/systemd/penumbra-explorer-frontend.service /etc/systemd/system/
rm -rf /etc/systemd/system/penumbra-explorer-frontend.service.d  # drop-in folded in
systemctl daemon-reload
```

Run `daemon-reload` only once `shared/.env` exists and a deploy is about to be
triggered: from that moment the unit expects `current/server.js`, and a crash
of the old process would restart into a path that does not exist yet.

Verify the whole chain from bkk07 before spending a CI run:

```sh
ssh -i /root/deploy-keys/penumbra-explorer -o IdentitiesOnly=yes \
    -J deploy-jump@160.22.180.7 web@10.7.78.85 'sudo -n -l'
```

The old `/opt/penumbra-explorer` checkout is left in place as the rollback
path and can be removed once a few CI deploys have been verified.

Then add the vhost from `deploy/nginx-penumbra.fi.conf.example` in CT1102.

## Known unverified

* `npm run stylelint` / `npm test` have not been run in this environment; if
  either is broken on `main` today, drop that step from `ci.yml`.
