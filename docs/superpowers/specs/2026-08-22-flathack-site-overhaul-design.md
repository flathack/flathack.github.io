# Flathack Website Overhaul — Design Specification

**Date:** 2026-08-22  
**Status:** Design approved; ready for implementation planning  
**Scope:** Complete static website (`20` HTML pages), shared CSS/JS, navigation, content presentation and SEO foundations

## Context

The site is a static GitHub Pages project for Flathack's Freelancer modding tools, projects, guides and support pages. The homepage currently exposes many tools as visually similar banners, while shared navigation and styling already exist in `assets/css/style.css` and `assets/js/nav.js`. The site supports German and English text plus dark/light themes.

The redesign must improve orientation across the whole site without changing the actual tool logic, generated data or external project links.

## Goals

1. Make the website understandable within the first screen: what Flathack is, which tools exist and what the next useful action is.
2. Create one coherent visual system for homepage, tool pages, projects, guides, help and the Freelancer 2D page.
3. Preserve the space/Freelancer identity while reducing the current glow, overlay and card-density overload.
4. Improve accessibility, responsive behavior, keyboard focus, reduced-motion handling and theme contrast.
5. Improve organic discoverability with page-specific metadata, semantic headings, canonical URLs, internal linking and crawl files.
6. Rewrite visible copy so it is concise, specific and natural in both German and English.

## Non-goals and constraints

- Do not rewrite the tool engines, data files or generated asset pipelines.
- Do not introduce a framework, bundler or runtime backend; the site remains deployable as static files.
- Preserve existing public paths, external project URLs and user-facing tool behavior unless a change is required for accessibility or navigation.
- Do not create a complex client-side search application as part of this pass.
- Keep the existing dark/light theme and language preference model, but make their behavior consistent and accessible.

## Product and visual direction

The selected direction is **A — Mission Control**:

- A focused hero instead of a stack of equally weighted promotional banners.
- A clear primary action such as opening the tool library.
- A compact set of high-signal modules: featured project, tool groups, latest update and community links.
- The existing cosmic background remains as brand atmosphere, but foreground surfaces become more opaque and the glow effects are reduced so text and controls stay legible.
- Typography remains based on the existing Space Grotesk / IBM Plex Mono pairing, with more disciplined type scale and spacing.
- Color accents continue to communicate categories/statuses, but color is never the only status signal.
- Hover animation is restrained; `prefers-reduced-motion` disables non-essential movement.

## Information architecture

The shared primary navigation becomes:

- Home
- Tools
- Projects
- Guides
- About

Utility controls remain available for language, theme and Help. On small screens the navigation must remain keyboard reachable and wrap or collapse without horizontal overflow.

### Homepage hierarchy

1. Hero: concise value proposition and one primary CTA.
2. Tool library grouped into `Build`, `Explore` and `Play`.
3. Featured FLAtlas project with release status and one primary project action.
4. Supporting projects, including clearly marked legacy/deprecated entries.
5. Latest updates and community links.
6. Compact footer with Help, About and project context.

### Page templates

All pages use the shared shell where applicable:

- site header/navigation
- page hero with eyebrow, H1 and concise description
- breadcrumbs for nested pages
- page-specific content/tool surface
- related tools or guides
- footer

Tool-specific controls and data views remain page-owned. Shared presentation components should not force unrelated tool pages into the same layout.

## Shared components and boundaries

The implementation will centralize these patterns:

- `site-shell`: page width, body surface and footer spacing
- `nav-capsule`: brand, primary navigation, language and theme controls
- `page-hero`: eyebrow, H1, supporting copy and primary action
- `tool-card`: tool category, status, description and CTA
- `project-card`: project status, version, progress and links
- `status-badge`: text plus visual status treatment
- `breadcrumbs`: semantic navigation trail
- `related-links`: contextual internal links
- `page-footer`: Help/About/community links and copyright

`assets/css/style.css` becomes the source of truth for shared tokens, components, themes and breakpoints. Homepage-only rules currently embedded in `index.html` move into the shared stylesheet or a small page-specific stylesheet section with clear boundaries.

`assets/js/nav.js` remains responsible for shared navigation, language/theme controls and path-aware active state. Existing tool engines and data scripts stay isolated.

## Content and unslop rules

- Use concrete labels that describe the result: `Trade routes berechnen`, `Schiffe vergleichen`, `Universum öffnen`.
- Avoid repeating the same mod list in every card; explain supported mods once at the relevant tool/library level.
- Keep status copy factual: version, release state, maintenance state or next milestone.
- Keep German and English semantically equivalent while allowing natural phrasing in each language.
- Avoid generic filler, stacked qualifiers, empty superlatives and repeated AI-style transitions.
- Keep legacy tools visible only when they help users migrate to the current replacement.

## SEO design

Every indexable HTML page receives:

- unique title aligned with the page's search intent
- unique meta description with a clear value proposition
- absolute self-referencing canonical URL
- Open Graph title/description/image where a useful preview exists
- correct `lang` value after language switching
- one meaningful H1 and logical H2/H3 hierarchy
- descriptive link text and image alt text
- internal links to related tools/guides

The site root receives `robots.txt` and `sitemap.xml` containing only canonical public pages. The homepage gets `WebSite`/`Organization` structured data; nested pages get `BreadcrumbList` where the hierarchy is meaningful. Structured data must be validated in the rendered browser, not only by static text search.

## Data flow and graceful failure

- The site remains static and loads existing local data/scripts as before.
- Navigation derives its active state from the current path and keeps working when page-specific JavaScript fails.
- Language and theme preferences continue to use browser storage, with safe defaults when storage is unavailable.
- External links keep `target="_blank"` only where useful and use `rel="noopener"`.
- Missing optional content should leave an intentional empty state rather than broken layout or empty headings.
- No SEO-critical content may exist only after JavaScript execution.

## Verification plan

### Automated checks

- Keep all existing Node tests passing.
- Add a structural site test covering page titles, descriptions, canonicals, language attributes, H1 count, robots/sitemap presence and selected internal links.
- Check that shared navigation and theme hooks remain present on all applicable pages.
- Check that existing release/version assertions remain valid.

### Browser checks

- Homepage and representative tool, project, guide and help pages at desktop and narrow mobile widths.
- Dark and light themes.
- German and English switching, including document language and visible copy.
- Keyboard-only traversal with visible focus.
- Reduced-motion preference.
- No horizontal overflow, clipped controls or broken cards.
- Rendered JSON-LD presence on pages that claim structured data.

### SEO checks

- Static inspection of all 20 HTML pages for metadata and heading requirements.
- Internal-link and local-asset resolution check.
- Robots/sitemap URL consistency.
- Rendered-page spot check for schema and final visible content.

## Implementation order

1. Establish shared tokens, component styles, focus states, responsive rules and reduced-motion support.
2. Refactor shared navigation and language/theme semantics without changing tool behavior.
3. Rebuild the homepage around Mission Control and the three tool groups.
4. Apply page heroes, breadcrumbs, related links and metadata across the page templates.
5. Add robots/sitemap/structured data and naturalized copy.
6. Run automated and browser verification, then fix regressions before handoff.

## Success criteria

The redesign is ready when a first-time visitor can identify Flathack's purpose and reach a relevant tool quickly; all page types share a coherent, readable, responsive system; language/theme/accessibility behavior works across representative pages; and the automated/browser SEO checks report no critical omissions.
