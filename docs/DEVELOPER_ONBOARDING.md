# Developer onboarding

## Access

Before starting, ask a team administrator to:

- add you to the Doppler team with access to the `realdealkickzsc` project and `dev` config;
- give your GitHub account access to `sneakereco/realdealkickzsc`.

## Prerequisites

Install:

- Git;
- Node.js `24.14.1`;
- Docker Desktop or Docker Engine;
- the Doppler CLI.

### Windows (PowerShell and winget)

```powershell
winget install --exact --id Git.Git
winget install --exact --id OpenJS.NodeJS.LTS --version 24.14.1
winget install --exact --id Docker.DockerDesktop
winget install --exact --id Doppler.Doppler
```

Open Docker Desktop after installation.

### macOS (Terminal and Homebrew)

```bash
xcode-select --install
brew install node@24
brew install --cask docker
brew install gnupg dopplerhq/cli/doppler
```

Open Docker Desktop after installation. The Homebrew `node@24` formula must provide
Node.js `24.14.1`; verify the version below before continuing.

### Ubuntu/Debian Linux (Terminal and apt)

Install Git and Docker with apt:

```bash
sudo apt update
sudo apt install -y git docker.io ca-certificates curl gnupg
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in after adding your user to the `docker` group.

Install Node.js `24.14.1` from the official Node.js download, then install Doppler:

```bash
curl -sLf --retry 3 --tlsv1.2 --proto '=https' \
  'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg
echo 'deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main' \
  | sudo tee /etc/apt/sources.list.d/doppler-cli.list
sudo apt update
sudo apt install -y doppler
```

Node.js does not publish an official apt repository that guarantees this exact patch
version. Use the official `24.14.1` Linux binary from
<https://nodejs.org/download/release/v24.14.1/>.

## Verify the prerequisites

```bash
git --version
node --version
npm --version
docker version
doppler --version
```

`node --version` must print `v24.14.1`, and `docker version` must show a running
Docker server.

## Start the application

```bash
git clone https://github.com/sneakereco/realdealkickzsc.git
cd realdealkickzsc
npm install
doppler login
doppler setup
npx supabase start
npm run dev
```

During `doppler setup`, use project `realdealkickzsc` and config `dev`. The checked-in
`doppler.yaml` supplies these defaults, so accepting the prompt should be enough.

Open the local URL printed by Next.js, normally <http://localhost:3000>.

## Before committing

Run all five commands and fix any failures:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:workflows
doppler run -- npm run build
```

Use `npm run test:unit:watch` while developing. Unit tests live in `tests/unit` and use
Vitest's Node environment; keep workflow configuration assertions on Node's built-in runner.

Do not commit until all five commands pass.

## Later starts

Start Docker, then run from the repository root:

```bash
npx supabase start
npm run dev
```

Stop the local Supabase services when you are done:

```bash
npx supabase stop
```

If startup fails, first confirm that Docker is running and that `doppler setup`
shows project `realdealkickzsc` with config `dev`.

## Feature branch to staging

1. Create a feature branch from the latest `main`:

   ```bash
   git switch main
   git pull --ff-only
   git switch -c <short-feature-name>
   ```

2. Make the change, then run the checks in [Before committing](#before-committing).

3. Commit, push the feature branch, and open a pull request into `main`:

   ```bash
   git add <changed-files>
   git commit -m "<type>: <short description>"
   git push -u origin <short-feature-name>
   ```

4. Wait for the pull request workflow to pass. It checks formatting, linting,
   typechecking, and a production build. Address review feedback and failed checks on
   the same feature branch.

5. Merge the pull request into `main` after approval and passing checks. The merge
   automatically starts the staging workflow, which:
   - validates formatting, linting, and types;
   - previews and applies pending Supabase migrations to staging;
   - builds and deploys the application to Vercel staging;
   - verifies the deployment through `/api/readyz`.

The change is available on staging only after every staging job passes. If the
workflow fails, open the failed GitHub Actions job, fix the cause on a feature branch,
and submit another pull request.
