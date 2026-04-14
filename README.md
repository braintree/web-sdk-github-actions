# braintree/braintree-web-sdk-github-actions

Shared composite actions and reusable workflows for Braintree Web SDK repositories.

## Composite Actions

### `actions/setup-node`

Setup Node.js from `.nvmrc`, install global npm, and optionally run `npm ci`.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: braintree/braintree-web-sdk-github-actions/actions/setup-node@main
    with:
      install-dependencies: "true"    # default: "true"
      node-version-file: ".nvmrc"     # default: ".nvmrc"
      registry-url: ""                # set when publishing to npm
```

### `actions/version-bump`

Validate CHANGELOG, bump npm version, create release branch + PR, merge, and tag.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: braintree/braintree-web-sdk-github-actions/actions/version-bump@main
    with:
      version-type: "patch"           # required: patch | minor | major
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Outputs:** `new-version` — the bumped version string (without `v` prefix).

**Requires permissions:**
```yaml
permissions:
  contents: write
  pull-requests: write
```

### `actions/release-notes`

Extract release notes from CHANGELOG.md and create a GitHub release using `gh` CLI.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: braintree/braintree-web-sdk-github-actions/actions/release-notes@main
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Requires permissions:**
```yaml
permissions:
  contents: write
```

### `actions/npm-publish`

Publish package to npm with provenance.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: braintree/braintree-web-sdk-github-actions/actions/npm-publish@main
    with:
      npm-token: ${{ secrets.BRAINTREE_NPM_ACCESS_TOKEN }}
      registry-url: "https://registry.npmjs.org/"  # default
```

**Requires permissions:**
```yaml
permissions:
  id-token: write   # for provenance
```

---

## Reusable Workflows

### CI

Run lint and tests. Replaces the `ci.yml` in 16+ repos.

```yaml
# .github/workflows/ci.yml
name: "CI"

on:
  push:
    branches: [main]
  pull_request:
    branches: ["*"]
  workflow_dispatch:
  workflow_call:

jobs:
  ci:
    uses: braintree/braintree-web-sdk-github-actions/.github/workflows/ci.yml@main
    # with:                                              # all optional
    #   lint-command: "npx eslint . --ext .js,.ts"       # default
    #   test-command: "npm test"                         # default
    #   runs-on: "ubuntu-latest"                         # default
    #   node-version-file: ".nvmrc"                      # default
```

**Common overrides:**

```yaml
# For repos using prettier instead of eslint:
with:
  lint-command: "npx prettier --check ."

# For repos with custom lint scripts:
with:
  lint-command: "npm run lint"

# To skip linting:
with:
  lint-command: ""

# For internal repos using PayPal runners:
with:
  runs-on: "gh-2-core-ubuntu-latest"
```

### Publish

Full publish pipeline: CI → version bump → npm publish → GitHub release.

```yaml
# .github/workflows/publish.yml
name: "Publish to npm"
run-name: Deploy ${{ github.repository }} to npmjs by @${{ github.actor }}

on:
  workflow_dispatch:
    inputs:
      version_type:
        description: "Version bump type (major, minor, patch)"
        required: true
        type: choice
        options:
          - patch
          - minor
          - major

jobs:
  publish:
    uses: braintree/braintree-web-sdk-github-actions/.github/workflows/publish.yml@main
    with:
      version-type: ${{ inputs.version_type }}
    secrets:
      npm-token: ${{ secrets.BRAINTREE_NPM_ACCESS_TOKEN }}
```

This single file replaces the previous `publish.yml` + `version-bump.yml` + `release-notes.yml` (3 files → 1).

### Stale Cleanup

Mark and close stale issues, PRs, and branches.

```yaml
# .github/workflows/stale-cleanup.yml
name: "Stale Cleanup"

on:
  schedule:
    - cron: "0 0 * * 3"   # midnight Wednesdays
  workflow_dispatch:

jobs:
  cleanup:
    uses: braintree/braintree-web-sdk-github-actions/.github/workflows/stale-cleanup.yml@main
    # with:                                      # all optional
    #   pr-days-stale: 14                        # default
    #   pr-days-close: 7                         # default
    #   issue-days-stale: 14                     # default
    #   issue-days-close: 7                      # default
    #   branch-days-stale: 21                    # default
    #   branch-days-close: 7                     # default
    #   exempt-branches: "^(main|gh-pages)$"     # default
    #   exempt-pr-labels: "dependencies"         # default
```

### PR Jira Check

Require a Jira ticket link in PR body.

```yaml
# .github/workflows/pr-jira-check.yml
name: "PR Jira Check"

on:
  pull_request:
    types: [opened, edited, reopened, synchronize, labeled]

jobs:
  check:
    uses: braintree/braintree-web-sdk-github-actions/.github/workflows/pr-jira-check.yml@main
    # with:
    #   jira-url-pattern: 'https://paypal\.atlassian\.net/browse/[A-Z]+-[0-9]+'
```

Skips bots, draft PRs, and PRs labeled `no-jira`.

---

## Migration Guide

### Before (typical repo — 3 workflow files)

```
.github/workflows/
├── ci.yml           (~25 lines)
├── publish.yml      (~50 lines)
├── version-bump.yml (~65 lines)
└── release-notes.yml (~40 lines)
```

### After (same repo — 2 workflow files)

```
.github/workflows/
├── ci.yml           (~15 lines)
└── publish.yml      (~20 lines)
```

### Steps

1. Replace `ci.yml` contents with the CI reusable workflow call (see above)
2. Replace `publish.yml` + `version-bump.yml` + `release-notes.yml` with the single publish workflow call
3. Delete `version-bump.yml` and `release-notes.yml`
4. Test: trigger CI on a PR, verify lint + tests run
5. Test: trigger publish with `workflow_dispatch` (use a patch bump on a test branch first)
