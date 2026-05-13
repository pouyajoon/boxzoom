# Boxzoom

Boxzoom is an Angular app for browsing tree-shaped JSON data as nested boxes.

## Routes

- `/` lists the available viewer modes.
- `/simpledom` lists the simple DOM datasets.
- `/simpledom/data2` opens `public/data2.json` with the simple DOM viewer.
- `/simpledom/data3` opens `public/data3.json` with the simple DOM viewer.
- `/domtransition` lists the transition datasets.
- `/domtransition/data3` opens `public/data3.json` with the DOM transition viewer.

Dataset routes share the same data-loading and tree navigation code. The route decides which JSON file to fetch and which viewer mode to use.

## Expected Behavior

The viewer shows one tree level at a time:

- The current node is rendered as the large parent box.
- The current node label is centered in the parent box.
- Direct children are rendered as boxes inside the parent box.
- Grandchildren are not shown until their parent child box is clicked.
- Clicking a child box drills into that child and makes it the new parent box.
- The Back button moves one level up.
- Breadcrumb buttons jump back to an ancestor node.
- Long parent and child labels wrap inside their boxes and use responsive font sizes.
- If a node has no children, the viewer shows `This node has no children.`

### Simple DOM Mode

The `/simpledom/...` routes change the current node immediately when a child box is clicked.

### DOM Transition Mode

The `/domtransition/...` routes keep the same parent and child layout, but clicking a child first animates that child box into the parent box position using CSS transitions. After the transition finishes, the clicked child becomes the new parent node.

## Data Shape

Dataset files are served from `public/` and use this recursive format:

```json
{
  "id": "France",
  "children": [
    {
      "id": "Ile-de-France",
      "children": []
    }
  ]
}
```

`data3.json` currently models:

`France > regions > departments > main cities`

## Development

Start the dev server:

```bash
pnpm start
```

Then open `http://localhost:4200/simpledom/`.

Build the app:

```bash
pnpm build
```

Run tests once:

```bash
pnpm exec ng test --watch=false
```

## GitHub Pages

The app is configured for GitHub project pages at `/boxzoom/`.

Public URL:

`https://pouyajoon.github.io/boxzoom/`

Build the static GitHub Pages artifact:

```bash
pnpm run build:github-pages
```

This creates `docs/` from the Angular build output, copies `index.html` to `404.html` for client-side route fallback, and writes `.nojekyll`.

Deployment is handled by `.github/workflows/pages.yml`.

**First-time setup (required once):**

1. Open [repository Pages settings](https://github.com/pouyajoon/boxzoom/settings/pages).
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` or use **Actions → Deploy GitHub Pages → Run workflow**.

Until Pages is enabled this way, the deploy job cannot create a site. Older failures such as [Actions run #25765314302](https://github.com/pouyajoon/boxzoom/actions/runs/25765314302) showed `configure-pages` / “Get Pages site failed” because no Pages site existed yet — the workflow no longer runs `configure-pages`, but **deploy still requires** Pages source set to GitHub Actions in settings.

Important static hosting details:

- `angular.json` has a `github-pages` build configuration with `baseHref: "/boxzoom/"`.
- Dataset JSON files are loaded relative to `document.baseURI`, so they work both locally and under `/boxzoom/` on GitHub Pages.
- `404.html` lets direct links like `/boxzoom/simpledom/data3` and `/boxzoom/domtransition/data3` load the Angular app.
