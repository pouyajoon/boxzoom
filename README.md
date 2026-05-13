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

The **`docs/`** folder in this repository is the published static site. It is committed on purpose so you can use **Deploy from a branch** and avoid GitHub Actions `deploy-pages` (no special repo permissions or “first deploy” API quirks).

### Update the live site after code changes

1. Regenerate **`docs/`**:

   ```bash
   pnpm run build:github-pages
   ```

   This runs the Angular `github-pages` build, writes output into **`docs/`**, copies `index.html` to **`404.html`** for SPA route fallback, and adds **`.nojekyll`**.

2. Commit **`docs/`** with your changes and push to **`main`**.

### First-time Pages setup (repository settings)

1. Open [repository Pages settings](https://github.com/pouyajoon/boxzoom/settings/pages).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch** (not GitHub Actions).
3. Choose branch **`main`**, folder **`/docs`**, then save.

GitHub builds nothing; it only serves the files already in **`docs/`**.

### Test locally (same paths as GitHub Pages)

```bash
pnpm run build:preview:github-pages
```

Then open the printed URL with **`/boxzoom/`** (for example `http://localhost:4173/boxzoom/`).

If **`docs/`** is already built:

```bash
pnpm run preview:github-pages
```

### CI

The **Verify Pages build** workflow (`.github/workflows/pages-build-verify.yml`) runs on pull requests and checks that `pnpm run build:github-pages` still succeeds from source. Remember to regenerate and commit **`docs/`** before merging if the app bundle changed.

### Static hosting notes

- `angular.json` has a `github-pages` configuration with **`baseHref: "/boxzoom/"`**.
- Dataset JSON is loaded relative to **`document.baseURI`**, so it works under **`/boxzoom/`**.
- **`404.html`** matches **`index.html`** so deep links load the Angular app.
