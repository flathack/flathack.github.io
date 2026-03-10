# Website Project Plan

## Goal

Create a GitHub Pages website that acts as the central hub for your projects.
The site should:

- present your projects clearly
- show current development status
- provide structured wiki content
- host documentation for your programs

## Primary Audiences

- players and users who want a quick project overview
- contributors who need status, roadmap, and technical context
- yourself as the central place for release notes, docs, and references

## Site Structure

### 1. Home

Purpose:
Introduce you, the project focus, and the most important links.

Content:

- short introduction
- featured projects
- current project status snapshot
- links to wiki and documentation
- latest updates or changelog preview

### 2. Projects

Purpose:
Show all active and archived projects in one place.

Content per project:

- project name
- short summary
- current status
- platform / tech stack
- repository link
- documentation link
- last major update

### 3. Status

Purpose:
Give visitors a fast overview of what is in progress.

Sections:

- active development
- planned features
- blocked items
- recently completed work
- release status

Suggested status labels:

- planning
- in development
- testing
- released
- paused
- archived

### 4. Wiki

Purpose:
Store project knowledge in a browsable, less formal format.

Suggested wiki categories:

- lore / background
- gameplay systems
- installation notes
- troubleshooting
- FAQ
- modding notes
- file structure explanations

### 5. Documentation

Purpose:
Provide formal documentation for each program or tool.

Suggested documentation sections per program:

- overview
- installation
- quick start
- configuration
- usage examples
- input / output behavior
- known issues
- version history

### 6. Updates / Changelog

Purpose:
Publish progress without requiring users to read commit history.

Content:

- release notes
- milestone summaries
- monthly progress posts

## Recommended Content Model

Keep content simple and file-based so GitHub Pages stays easy to maintain.

Suggested content folders:

- `projects/` for project overview pages
- `status/` for development updates
- `wiki/` for knowledge-base style pages
- `docs/` for program documentation
- `changelog/` for release notes and progress logs

## Suggested Initial Navigation

- Home
- Projects
- Status
- Wiki
- Docs
- Changelog
- About

## MVP Phase

First version of the website should include:

- a landing page
- one project overview page
- one status page
- one wiki index page
- one documentation index page
- one first documentation page for a program

## Content Priorities

Priority 1:

- explain what the project is
- show whether it is active
- link users to the right section quickly

Priority 2:

- provide useful wiki articles
- provide installation and usage documentation

Priority 3:

- add polished design, timeline views, search, and richer navigation

## Technical Direction

Recommended starting approach:

- static GitHub Pages site
- simple HTML/CSS/JS first
- Markdown-driven content where possible
- no heavy framework unless maintenance clearly benefits from it

Reason:
You can publish fast, keep hosting simple, and write docs directly in the repo.

## Maintenance Workflow

Recommended workflow:

1. Update project status after important work sessions.
2. Add documentation whenever a program gains a user-facing feature.
3. Move repeated support answers into wiki pages.
4. Publish changelog entries for releases and milestones.

## Future Expansion

Possible later features:

- automatic project status cards
- screenshots and gallery pages
- multilingual content
- search across docs and wiki
- downloadable releases page
- roadmap timeline

## Next Implementation Steps

1. Create the base site structure and navigation.
2. Add an `index.html` landing page.
3. Add placeholder pages for `projects`, `status`, `wiki`, and `docs`.
4. Add the first real content for your main project.
5. Publish via GitHub Pages and iterate from there.
