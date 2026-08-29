# flathack.github.io

Static GitHub Pages site for Flathack project pages, documentation, support articles, and Freelancer modding tools.

## Contents

- `index.html`: main project overview
- `docs`: standalone tool pages and documentation views
- `help`: support articles and setup guides
- [Freelancer 2D](https://flathack.github.io/Freelancer-2D/): live browser prototype ([source repository](https://github.com/flathack/Freelancer-2D))
- `assets`: shared styles, images, scripts, and generated widgets
- `data`: generated data used by the browser tools
- `tools`: helper scripts for generating site data and assets

## Local Preview

The site is static, so most pages can be opened directly in a browser. For fetch-based pages and generated data, run a small local server from the repository root:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Updating Data

Generated data and rendered assets live in `data`, `assets`, and selected documentation pages.
When changing generator scripts in `tools`, regenerate the affected outputs and check the changed files before committing.

## License

MIT License. See [LICENSE](LICENSE).
