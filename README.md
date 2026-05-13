# Boxzoom

Boxzoom is an Angular app for browsing tree-shaped JSON data as nested boxes.

## Routes

- `/` lists the available viewer modes.
- `/simpledom` lists the simple DOM datasets.
- `/simpledom/data2` opens `public/data2.json` with the simple DOM viewer.
- `/simpledom/data3` opens `public/data3.json` with the simple DOM viewer.
- `/domtransition` lists the transition datasets.
- `/domtransition/data3` opens `public/data3.json` with the DOM transition viewer.
- `/uniqdom` lists the recursive (uniq DOM) datasets.
- `/uniqdom/data2` opens `public/data2.json` with the recursive viewer.
- `/uniqdom/data3` opens `public/data3.json` with the recursive viewer.

Dataset routes share the data-loading scaffolding, but the **viewer mode**
chosen by the route also picks the rendering strategy (see below for the
differences between Simple DOM, DOM Transition, and Uniq DOM).

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

### Uniq DOM Mode

The `/uniqdom/...` routes use a fundamentally different rendering pattern: there is **one DOM element per tree node**, and the whole tree is mounted once. Clicking a child does **not** swap the parent box for a fresh DOM; instead, that very child's `<div>` is the one that grows to fill its parent's content area, and only then does it reveal its own children inside itself. Going back shrinks it back into its grid cell. See the dedicated section below for the architecture.

## Documentation métier (boîtes, navigation, animations)

Cette section résume le **travail réalisé sur les boîtes** et les **règles métier** codées dans `DataViewer` (`src/app/data-viewer.ts`), le gabarit `data-viewer.html` et les styles `data-viewer.css`, pour que la logique de « zoom » et d’animation soit lisible sans parcourir tout le code.

### Modèle d’affichage : une boîte parent, un niveau d’enfants

- L’arborescence JSON est un arbre de nœuds `{ id, children[] }`.
- À tout moment, l’écran ne montre **qu’un seul niveau** : le **nœud courant** dans une grande **boîte parent** (`.root-box`), et **uniquement ses enfants directs** dans des **boîtes enfant** (`.child-box`). Les petits-enfants n’apparaissent qu’après un nouveau « zoom » sur l’enfant correspondant.
- Le libellé du parent est le `id` du nœud courant (`.box-label`). Chaque enfant affiche son propre `id`.

### Règles de navigation (« zoom » dans l’arbre)

| Action | Règle métier |
|--------|----------------|
| **Clic / activation sur une boîte enfant** | Le nœud cliqué devient le **nouveau parent** ; le chemin d’ancêtres (`currentPath`) est étendu avec son `id`. |
| **Bouton Back** | Remonte **d’un cran** : le dernier segment du chemin est retiré ; on réaffiche l’ancêtre correspondant. **Désactivé** si on est déjà à la racine du chemin (un seul segment). |
| **Fil d’Ariane (breadcrumbs)** | Chaque segment est un bouton ; cliquer un ancêtre **saute** directement à ce nœud (troncature du chemin). Le segment du **nœud courant** est désactivé (pas de clic inutile). |
| **Feuille (pas d’enfants)** | Message fixe : *This node has no children.* |
| **Clavier sur une enfant** | **Entrée** ou **Espace** déclenche la même ouverture qu’un clic (`preventDefault` / `stopPropagation`). |

Le chemin est une liste d’`id` depuis la racine du JSON jusqu’au nœud courant ; la résolution d’un nœud depuis la racine se fait en suivant `children` dans l’ordre du chemin (`findNode`).

### Deux modes de vue (même données, comportement de transition différent)

La route fixe le **mode** (`simpledom` vs `domtransition`) ; le chargement des données et la navigation sont **partagés**, seule la réaction au clic sur un enfant change.

#### Mode Simple DOM (`/simpledom/...`)

- **Règle** : au clic sur un enfant, **changement immédiat** de l’état affiché (`showNode`) — pas d’animation de transition entre parent et enfant.
- Les enfants peuvent toujours jouer l’animation d’**entrée** Animate.css (voir ci‑dessous) à chaque réaffichage du niveau.

#### Mode DOM Transition (`/domtransition/...`)

- **Règle** : au clic, on **ne** met pas à jour le nœud courant tout de suite ; on enchaîne une **séquence visuelle** puis on aligne le modèle sur le nouvel enfant.
- **Mesures** : on lit les rectangles écran (`getBoundingClientRect`) de la boîte enfant cliquée et du parent `.root-box`.
- **Clone fixe** : une copie visuelle (`transition-clone`, `position: fixed`) est positionnée exactement sur l’enfant, avec le même style de bordure que la transition. Le libellé du clone reprend l’`id` de l’enfant.
- **État « source »** : l’enfant cliqué reçoit la classe `.transition-source` (opacité très basse, animation d’entrée coupée) pour éviter le double rendu pendant que le clone bouge.
- **Parent atténué** : `.parent-fading` sur `.root-box` (opacité ~0,12) pendant la transition pour mettre l’accent sur le clone.
- **Animation du clone** : après **deux** `requestAnimationFrame`, les styles du clone passent du rectangle **enfant** au rectangle **parent** (propriétés animées en CSS sur ~**900 ms** : `left`, `top`, `width`, `height`, `border-radius`). Le libellé du clone passe d’une position **centrée verticalement** (comme un libellé d’enfant dans la grille) à une position **haut-gauche** (comme le titre du parent), avec transition des mêmes **900 ms** sur position, `transform` et `font-size` (tailles calculées depuis les styles calculés du DOM réel).
- **Fin de la translation** : au bout de **900 ms + 20 ms** de garde, on appelle `showNode` pour que le **nouveau parent** soit l’enfant cliqué ; on retire l’atténuation du parent réel et on lance le **fondu du clone** (opacité vers 0 sur ~**1000 ms**, puis nettoyage après **1000 ms + 40 ms**).
- **Repli** : si le DOM ne fournit pas l’élément enfant ou le parent attendu, on **retombe** sur le comportement Simple DOM (`showNode` direct) pour ne pas bloquer la navigation.

**Constantes** (dans `app.ts`) : `DOM_TRANSITION_DURATION_MS = 900`, `DOM_TRANSITION_HANDOFF_MS = 1000`.

#### Verrou pendant une transition

- Tant qu’un clone de transition est actif (`transitionClone` non nul), **aucun nouveau** `openChild` n’est accepté : évite les transitions concurrentes et les états incohérents.

### Animations des boîtes enfants (Animate.css)

- Chaque enfant a les classes `animate__animated animate__bounceIn` (entrée en « rebond »).
- **Durée** de l’animation : `--animate-duration: 680ms` sur `.child-box`.
- **Échelonnement (stagger)** : `animation-delay: calc(var(--child-index, 0) * 70ms)` — le premier enfant part en premier, puis chaque suivant avec **70 ms** de décalage d’index.
- **Hover / focus** : léger survol (bordure, ombre, `translateY(-2px)`) ; contour visible au clavier (`:focus-visible`).

### Résumé des différences « zoom » vs « animation »

- **Zoom métier** = mise à jour du **nœud courant** et du **chemin** dans l’arbre (un niveau à la fois, retour arrière et fil d’Ariane).
- **Animation** = soit **entrée des enfants** (tous modes), soit **en plus** en mode DOM Transition la **translation du clone** + **fondu** + **atténuation du parent**, avec timings fixes ci‑dessus.

## Mode Uniq DOM : un seul DOM, pas de re‑render

Le mode **Uniq DOM** (`/uniqdom/...`) répond à une limite structurelle des deux modes précédents : dès qu’on change de niveau, le DOM du parent est **remplacé** par celui de l’ancien enfant. Toute animation préalable se termine forcément sur un changement de DOM, et c’est ce changement qui « casse » la transition.

### Modèle de rendu : un composant par nœud, tout l’arbre est monté

Le composant `TreeNodeView` (`src/app/tree-node.ts` + `src/app/tree-node.html` + `src/app/tree-node.css`) est **récursif** : il rend une boîte pour son nœud, puis un `*ngFor` qui instancie un `TreeNodeView` pour chacun de ses enfants. La hiérarchie du DOM épouse donc la hiérarchie de la donnée. Tout l’arbre est mounted une fois pour toutes ; aucun nœud n’est jamais détruit ni recréé lors d’un zoom.

À tout instant, chaque nœud est dans un état visuel calculé à partir d’un **chemin courant** partagé (`TreeStateService.currentPath`, signal Angular) :

| État visuel | Quand | Rendu |
|---|---|---|
| **`tree-node--root`** | Le nœud racine du JSON. | Boîte ancrée, `position: relative`, occupe la zone du viewer. |
| **`tree-node--big`** (non root) | Le nœud appartient au chemin courant. | `position: absolute; inset: 0` ; remplit la zone de contenu de son parent, c’est lui qu’on voit. |
| **`tree-node--small`** | Le nœud n’est pas sur le chemin mais son parent est `big`. | Tuile dans la grille de son parent (`grid-template-columns: repeat(auto-fit, …)`). Cliquable pour zoomer. |
| **`tree-node--sibling-faded`** | Frère d’un nœud `big` plus profond. | Petite tuile dans la grille du parent commun, opacité 0 (transition CSS), `pointer-events: none`. |

Un nœud `big` n’est pas cliquable (vous êtes déjà dessus) ; seuls ses descendants `small` directement visibles le sont. La grille des enfants est rendue dans un `tree-node__content` qui n’est visible (`opacity: 1`) que lorsque le nœud est `big`, ce qui évite que des grands-enfants invisibles n’interceptent les clics.

### État partagé : signaux Angular dans un service

`TreeStateService` est un `@Injectable()` fourni au niveau de `UniqDomViewer` (`providers: [TreeStateService]`), donc partagé par toute l’arborescence récursive sous lui. Pourquoi pas Jotai ? Les **signaux Angular** offrent exactement la granularité réactive qu’on cherchait, sans dépendance externe, et s’intègrent avec `OnPush` côté change detection. Le service expose :

- `currentPath: WritableSignal<string[]>` — le chemin courant (liste d’`id` du root jusqu’au nœud zoomé).
- `setPath(path)`, `zoomInto(parentPath, childId)`, `goBack()`, `jumpTo(index)` — toutes passent par `setPath`, qui **snapshot les rectangles** de tous les nœuds enregistrés **avant** de muter le chemin (voir FLIP plus bas).
- `isOnPath(nodePath)` — utilisé par chaque `TreeNodeView` dans un `computed()` pour dériver `isBig`, `isSiblingFaded`, etc.
- `registerElement(id, el)` / `unregisterElement(id, el)` — chaque `TreeNodeView` s’enregistre dans `ngOnInit` et se désinscrit dans `ngOnDestroy`. Le service garde une `Map<string, HTMLElement>`.

Chaque composant a un `effect()` qui réagit à un changement de `isBig()` ; c’est là que l’animation FLIP est déclenchée.

### Animation : FLIP via Web Animations API

Le problème principal de l’ancien `domtransition` était la **désynchronisation entre l’animation et le re‑render** : un clone bouge, puis le DOM change, puis on essaie de cacher la cassure avec un fondu. Ici, comme **le DOM ne change pas**, on n’a plus besoin de clone : on anime simplement la transformation visuelle du même élément, en gardant son layout final déjà appliqué. C’est le pattern **FLIP** (*First, Last, Invert, Play*) :

1. **First** : juste avant de modifier `currentPath`, `TreeStateService.snapshotRects()` lit `getBoundingClientRect()` de **tous** les nœuds enregistrés et les stocke dans `prePathRects: Map<string, DOMRect>`.
2. **Last** : `currentPath` est muté → Angular re‑évalue les `computed()` → `OnPush` réactive le composant concerné → la classe CSS passe de `tree-node--small` à `tree-node--big` (ou l’inverse). Le navigateur applique le nouveau layout en mémoire. L’`effect()` de chaque composant dont `isBig` a changé lit alors le **nouveau** `getBoundingClientRect()`.
3. **Invert** : on calcule la transformation qui projette le **nouveau** rectangle sur l’**ancien** : `translate(dx, dy) scale(sx, sy)`. C’est l’*image keyframe* de départ de l’animation.
4. **Play** : `el.animate([{ transform: invert }, { transform: identity }], { duration: 600ms, easing: ‘ease‑out‑expo’ })` ramène la transformation à l’identité. Visuellement, la boîte semble glisser/grandir de son ancien emplacement vers son nouveau, alors que son **layout réel est déjà au final**.

Comme le layout est dans son état final pendant toute la durée de l’animation, ses enfants peuvent être rendus à la bonne place dès la première frame ; il n’y a **plus de moment de bascule** entre « animation » et « DOM réel ».

#### Synchronisation visuelle des sous-éléments

- **Label** : son `position` (centré quand `small`, ancré en haut quand `big`) ainsi que sa `font-size` sont sous transitions CSS de **600 ms** (mêmes durée et easing que le FLIP), donc le label glisse et se redimensionne en cohérence avec la boîte qui grandit/rétrécit.
- **Grille d’enfants** (`tree-node__content`) : `opacity` 0 → 1 (240 ms ease, **delay 320 ms**) à l’ouverture pour que les petits-enfants n’apparaissent qu’au moment où la boîte est presque arrivée à destination. À la fermeture, fondu sans délai (220 ms) pour disparaître pendant que la boîte rétrécit.
- **Frères** (`tree-node--sibling-faded`) : `opacity` 0 (220 ms ease) pour se retirer visuellement quand un de leurs frères est `big`.

#### Comportement Back et fil d’Ariane

- **Back** : `goBack()` retire le dernier segment de `currentPath`. Le nœud le plus profond `big` voit `isBig` passer à `false` → son effect déclenche un FLIP **inverse** (de son rectangle plein vers son ancienne tuile dans la grille). Sa grille d’enfants se fade out, ses frères se ré‑afficient.
- **Breadcrumb** : `jumpTo(index)` tronque le chemin au segment cliqué. Plusieurs nœuds peuvent changer d’état d’un coup ; chacun fait son propre FLIP indépendamment (l’imbrication des transformations composées reste visuellement cohérente pour les usages normaux).

### Constantes (`src/app/tree-node.ts`)

- `UNIQ_FLIP_MS = 600` — durée du FLIP **et** des transitions CSS du label.
- `UNIQ_FLIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'` — easing commun.

### Pourquoi pas Angular Animations ?

Angular Animations marche très bien pour les transitions d’entrée/sortie de bindings, mais ici la **persistance** du même DOM entre `small` et `big` est le cœur du design ; le FLIP via Web Animations API se plie naturellement à ce contrat (on a déjà la référence à l’élément, et on contrôle frame à frame). Les transitions CSS suffisent pour le reste (label, opacités).

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
