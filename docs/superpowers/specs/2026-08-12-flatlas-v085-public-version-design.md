# FLAtlas v0.8.5 Public Version Update

## Goal

Update every remaining public `v0.8.3` reference in this website repository to the released FLAtlas version `v0.8.5`.

## Scope

Update the FLAtlas card version on `index.html`, its German and English status text, and the matching release label in `flatlas/devstatus.json`. Keep the existing `v0.9.0` work-in-progress message, progress values, feature descriptions, and links unchanged.

## Verification

Search the repository to confirm no `v0.8.3` or `0.8.3` reference remains outside historical Superpowers documentation. Run the focused homepage test and the complete Node-based test suite, then inspect `git diff --check` and the final diff before committing and pushing.
