# braintree/web-sdk-github-actions

Shared composite actions and reusable workflows for Braintree Web SDK repositories.

## Composite Actions

### `actions/setup-node`

Setup Node.js from `.nvmrc`, install global npm, and optionally run `npm ci`.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: braintree/web-sdk-github-actions/actions/setup-node@main
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
  - uses: braintree/web-sdk-github-actions/actions/version-bump@main
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
  - uses: braintree/web-sdk-github-actions/actions/release-notes@main
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      dry-run: "false"   # set to "true" to skip gh release create
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
  - uses: braintree/web-sdk-github-actions/actions/npm-publish@main
    with:
      npm-token: ${{ secrets.BRAINTREE_NPM_ACCESS_TOKEN }}
      registry-url: "https://registry.npmjs.org/"  # default
      dry-run: "false"                              # set to "true" to run npm publish --dry-run
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
    uses: braintree/web-sdk-github-actions/.github/workflows/ci.yml@main
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

# To skip testing:
with:
  test-command: ""

# For internal repos using PayPal runners:
with:
  runs-on: "gh-2-core-ubuntu-latest"
```

### Release Pipeline

Full release pipeline: CI → version bump → npm publish → GitHub release. This is the primary entrypoint for most repos.

```yaml
# .github/workflows/release-pipeline.yml
name: "Release"

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
  release:
    uses: braintree/web-sdk-github-actions/.github/workflows/release-pipeline.yml@main
    with:
      version-type: ${{ inputs.version_type }}
    secrets:
      npm-token: ${{ secrets.BRAINTREE_NPM_ACCESS_TOKEN }}
```

This single file replaces the previous `publish.yml` + `version-bump.yml` + `release-notes.yml` (3 files → 1).

### Publish

Publish-only workflow: npm publish → GitHub release. Use this when the version has already been bumped, or to re-publish without re-running CI and the version bump. Supports `dry-run` for testing without side effects.

```yaml
# .github/workflows/publish.yml
name: "Publish"

on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Tag or ref to publish (e.g. v3.142.1)"
        required: true
        type: string
      dry_run:
        description: "Dry run (npm --dry-run, skip GitHub release)"
        required: false
        type: boolean
        default: false

jobs:
  publish:
    uses: braintree/web-sdk-github-actions/.github/workflows/publish.yml@main
    with:
      ref: ${{ inputs.ref }}
      dry-run: ${{ inputs.dry_run }}
    secrets:
      npm-token: ${{ secrets.BRAINTREE_NPM_ACCESS_TOKEN }}
```

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
    uses: braintree/web-sdk-github-actions/.github/workflows/stale-cleanup.yml@main
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

### PR Title Validation

Validate that the PR title follows conventional commits.

This file is to be used on **PRs in public/OSS repos**, which we do not link Jira tickets on.

```yaml
# .github/workflows/pr-title-validation.yml
name: "PR Title Validation"

on:
  pull_request:
    types: [opened, edited, reopened, synchronize, labeled]

jobs:
  validate:
    uses: braintree/web-sdk-github-actions/.github/workflows/pr-title-validation.yml@main
    secrets:
      github-token: ${{ secrets.GITHUB_TOKEN }}
    # with:                                                    # all optional
    #   conventional-commit-types: |                          # default list of types
    #     feat
    #     fix
    #     ...
    #   conventional-commit-scopes: ""                        # default: any scope allowed
    #   ignore-labels: ""                                     # labels that skip title validation
    #   runs-on: "ubuntu-latest"                              # default
```

### PR Title + Jira Validation

Validate PR title follows conventional commits **and** require a Jira ticket link in the PR body.

This file is to be used on **PRs in internal repos**, as we expect a Jira link on each PR.

```yaml
# .github/workflows/pr-title-jira-validation.yml
name: "Validate PR"

on:
  pull_request:
    types: [opened, edited, reopened, synchronize, labeled]

jobs:
  validate:
    uses: braintree/web-sdk-github-actions/.github/workflows/pr-title-jira-validation.yml@main
    secrets:
      github-token: ${{ secrets.GITHUB_TOKEN }}
    # with:                                                    # all optional
    #   conventional-commit-types: |                          # default list of types
    #     feat
    #     fix
    #     ...
    #   conventional-commit-scopes: ""                        # default: any scope allowed
    #   ignore-labels: ""                                     # labels that skip title validation
    #   runs-on: "ubuntu-latest"                              # default
```

Skips bots, draft PRs, and PRs labeled `no-jira`.

---

## Migration Guide

### Before (typical repo — 3 workflow files)

```text
.github/workflows/
├── ci.yml           (~25 lines)
├── publish.yml      (~50 lines)
├── version-bump.yml (~65 lines)
└── release-notes.yml (~40 lines)
```

### After (same repo — 2 workflow files)

```text
.github/workflows/
├── ci.yml                (~15 lines)
└── release-pipeline.yml  (~20 lines)
```

### Steps

1. Replace `ci.yml` contents with the CI reusable workflow call (see above)
2. Replace `publish.yml` + `version-bump.yml` + `release-notes.yml` with the single release pipeline workflow call
3. Delete `version-bump.yml` and `release-notes.yml`
4. Test: trigger CI on a PR, verify lint + tests run
5. Test: trigger release with `workflow_dispatch` (use a patch bump on a test branch first)
