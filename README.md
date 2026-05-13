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

[https://pouyajoon.github.io/boxzoom/](https://pouyajoon.github.io/boxzoom/)

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

### Site returns 404 at `https://pouyajoon.github.io/boxzoom/`

The static files are in the repo (for example [`docs/index.html` on `main`](https://raw.githubusercontent.com/pouyajoon/boxzoom/main/docs/index.html)). A **404** on the Pages URL almost always means **Pages is not publishing `main` + `/docs`**.

1. Open [Pages settings](https://github.com/pouyajoon/boxzoom/settings/pages).
2. **Build and deployment → Source** must be **Deploy from a branch** (not **GitHub Actions**). This repo no longer deploys via Actions; if Source is still **GitHub Actions**, GitHub will not serve the committed **`docs/`** folder and the site can stay empty or 404.
3. Branch **`main`**, folder **`/docs`** (not the repository **root** — there is no `index.html` at the repo root).
4. Save, wait a minute, then check the green banner on that settings page for the live URL. Hard-refresh or try an incognito window if you still see an old 404.

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

- `angular.json` sets **`baseHref: "/boxzoom/"`** so direct links and hard reloads work on project-page URLs like **`https://pouyajoon.github.io/boxzoom/...`** (see the note below on why a “pathless” base is usually a bad tradeoff).
- Dataset JSON is loaded relative to **`document.baseURI`**, so it works under **`/boxzoom/`**.
- **`404.html`** matches **`index.html`** so deep links load the Angular app.

**Why not drop `/boxzoom/` from `<base>`?** A relative base such as `./` matches **`npx http-server docs`** when you stay on **`/`**, but on a URL like **`.../boxzoom/simpledom/data3`** the browser resolves scripts against **`.../boxzoom/simpledom/`**, so hashed bundles miss and the app breaks on refresh or shared deep links. GitHub project pages live under **`/repo-name/`**, so the production build keeps **`baseHref: "/boxzoom/"`**. To preview locally without that prefix, use **`pnpm run build:preview:github-pages`** (serves under **`/boxzoom/`**) or **`pnpm start`** for dev.
