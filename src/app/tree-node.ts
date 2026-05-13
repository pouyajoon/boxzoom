import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { TreeStateService } from './tree-state.service';

export type UniqTreeNode = {
  id: string;
  children: UniqTreeNode[];
};

/**
 * Animation length used both by the FLIP transform and by the CSS transitions
 * that reposition the label inside each box. Kept in sync so the label slide,
 * the children fade and the box scale all finish together.
 */
/**
 * FLIP animation timing for the "child grows into parent" / "parent shrinks
 * back to child" transitions. The duration is shared with the CSS transitions
 * applied to the label (top/left/right/transform/font-size) in tree-node.css,
 * so the label slide and the box scale finish on the same frame.
 */
const UNIQ_FLIP_MS = 1000;
const UNIQ_FLIP_EASE = 'ease-in-out';

/**
 * jackInTheBox animation (from animate.css, imported globally in styles.css)
 * tuning. The animation plays on each small tile when its parent becomes the
 * current "leaf big" — i.e. when this tile becomes visibly displayed as a
 * child of the currently zoomed-in box.
 *
 *   - `UNIQ_JACK_MS`: total animation length. Kept shorter than the FLIP so
 *     the children land on screen before the parent finishes growing.
 *   - `UNIQ_JACK_STAGGER_MS`: per-child stagger so they pop in one after the
 *     other rather than all simultaneously. Indexed by `indexFromParent`.
 *   - `UNIQ_JACK_BASE_DELAY_MS`: shifts every child's animation forward so it
 *     starts after the parent FLIP has visibly begun (otherwise the jack
 *     plays while the parent box is still scaled down by the FLIP inverse
 *     and the children pop in essentially invisibly). With the FLIP at 1s,
 *     ~400ms keeps the children appearing during the second half of the
 *     parent's grow.
 */
const UNIQ_JACK_MS = 600;
const UNIQ_JACK_STAGGER_MS = 80;
const UNIQ_JACK_BASE_DELAY_MS = 400;

/**
 * Recursive viewer for a single tree node.
 *
 * Every node in the JSON tree is rendered by an instance of this component.
 * Each instance owns its own DOM box and decides, from the shared
 * `TreeStateService`, whether it should appear:
 *
 *   - `big`  (on the zoom path) → rendered as a large box that absolutely
 *            fills its parent's content area and exposes a grid of its own
 *            (small) children. The deepest big node is the one the user is
 *            currently looking at.
 *   - `small` (off the zoom path) → rendered as a tile inside the grid of
 *            its parent's content area. Clicking it zooms into it.
 *   - `sibling-faded` → a small sibling of a node that is currently zoomed
 *            into; opacity is animated down so the visible content is the
 *            zoomed branch only.
 *
 * Going between `small` and `big` does **not** swap a DOM element. The very
 * same `<div class="tree-node">` is the one that grows or shrinks, so its
 * children remain stable references and the animation cannot desynchronise
 * with a re-rendered tree. The animation itself is a FLIP done with the
 * Web Animations API.
 *
 * Important: we measure the inner `<div #box class="tree-node">`, not the
 * `<app-tree-node>` host element. The host stays in its parent's grid cell
 * even when the inner box goes `position: absolute`, so measuring the host
 * would always return the same DOMRect and the FLIP delta would be zero.
 * `:host { display: contents }` (in tree-node.css) removes the host from
 * the layout entirely so the inner box IS the grid item.
 */
@Component({
  selector: 'app-tree-node',
  imports: [CommonModule],
  templateUrl: './tree-node.html',
  styleUrl: './tree-node.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeNodeView implements OnInit, OnDestroy {
  @Input({ required: true }) node!: UniqTreeNode;
  @Input({ required: true }) path!: readonly string[];
  /** Top-level node, never moves to position: absolute. */
  @Input() isRoot = false;
  /** Index among my parent's children — used to stagger the jackInTheBox. */
  @Input() indexFromParent = 0;

  /**
   * The actual box `<div class="tree-node">`. We need a ViewChild here because
   * `inject(ElementRef)` points at the `<app-tree-node>` host element, and
   * that host's rect does not reflect the inner box's layout change between
   * `small` (grid cell) and `big` (absolute fill).
   */
  @ViewChild('box', { static: true }) private boxRef!: ElementRef<HTMLElement>;

  private readonly state = inject(TreeStateService);
  private readonly injector = inject(Injector);
  private prevIsBig: boolean | null = null;
  private prevIsParentLeafBig: boolean | null = null;
  private firstEffect = true;
  private currentAnimation: Animation | null = null;
  private jackAnimationEndHandler: ((event: AnimationEvent) => void) | null = null;

  childPaths: ReadonlyArray<readonly string[]> = [];

  readonly isBig = computed(() => this.state.isOnPath(this.path));
  readonly isLeafBig = computed(() => {
    const cp = this.state.currentPath();
    return cp.length === this.path.length && this.isBig();
  });
  /**
   * I'm "sibling-faded" when the path zooms past my level into a sibling of
   * mine: my parent is on path, but I am not on path.
   */
  readonly isSiblingFaded = computed(() => {
    const cp = this.state.currentPath();
    const parentLen = this.path.length - 1;
    if (parentLen < 0 || cp.length <= parentLen) {
      return false;
    }
    for (let i = 0; i < parentLen; i += 1) {
      if (this.path[i] !== cp[i]) {
        return false;
      }
    }
    return cp[parentLen] !== this.path[parentLen];
  });
  /**
   * True when my direct parent is the current "leaf big" — i.e. I'm one of
   * the small tiles visibly laid out as a child of the currently zoomed-in
   * node. We use this to know when to play the jackInTheBox entrance
   * animation. The root has no parent, so it always returns false.
   */
  readonly isParentLeafBig = computed(() => {
    const cp = this.state.currentPath();
    const parentLen = this.path.length - 1;
    if (parentLen < 0 || cp.length !== parentLen) {
      return false;
    }
    for (let i = 0; i < parentLen; i += 1) {
      if (cp[i] !== this.path[i]) {
        return false;
      }
    }
    return true;
  });

  constructor() {
    effect(() => {
      const isBig = this.isBig();
      const isParentLeafBig = this.isParentLeafBig();

      if (this.firstEffect) {
        this.firstEffect = false;
        this.prevIsBig = isBig;
        this.prevIsParentLeafBig = isParentLeafBig;
        /*
         * On the very first render, any tile that is already a visible small
         * child of the current leaf-big should also "pop in" with
         * jackInTheBox. Without this, the initial route load would just
         * snap the children into place.
         */
        if (isParentLeafBig) {
          afterNextRender(() => this.playJackInTheBox(), { injector: this.injector });
        }
        return;
      }

      const wasBig = this.prevIsBig;
      const wasParentLeafBig = this.prevIsParentLeafBig;
      this.prevIsBig = isBig;
      this.prevIsParentLeafBig = isParentLeafBig;

      /*
       * Defer the FLIP measurement to afterNextRender so we read the box's
       * post-CD layout (after class bindings flushed) and apply the inverse
       * transform before the next paint.
       */
      if (wasBig !== isBig) {
        afterNextRender(() => this.applyFlip(), { injector: this.injector });
      }

      /*
       * Play jackInTheBox when this tile newly becomes a visible small child
       * of the leaf-big — i.e. its parent has just become the zoom target.
       * Crucially we SKIP this when the tile itself was big a moment ago:
       * that means it's the tile the user is "zooming out from", and it's
       * currently being FLIPped back down to its small size. Adding
       * jackInTheBox on top of the FLIP would fight over opacity/transform.
       */
      if (isParentLeafBig && !wasParentLeafBig && !wasBig) {
        afterNextRender(() => this.playJackInTheBox(), { injector: this.injector });
      }
    });
  }

  ngOnInit(): void {
    this.childPaths = this.node.children.map((child) => Object.freeze([...this.path, child.id]));
    this.state.registerElement(this.node.id, this.boxRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.state.unregisterElement(this.node.id, this.boxRef.nativeElement);
    this.currentAnimation?.cancel();
    this.currentAnimation = null;
    const el = this.boxRef?.nativeElement;
    if (el && this.jackAnimationEndHandler) {
      el.removeEventListener('animationend', this.jackAnimationEndHandler);
      this.jackAnimationEndHandler = null;
    }
    if (el) {
      el.style.animation = '';
    }
  }

  onClick(event: Event): void {
    event.stopPropagation();
    if (this.isBig()) {
      return;
    }
    this.state.zoomInto(this.path.slice(0, -1), this.node.id);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (this.isBig()) {
      return;
    }
    this.state.zoomInto(this.path.slice(0, -1), this.node.id);
  }

  trackById(_index: number, child: UniqTreeNode): string {
    return child.id;
  }

  /**
   * FLIP: First-Last-Invert-Play.
   *
   *   - First: captured by `TreeStateService.snapshotRects()` before the
   *     `currentPath` signal mutated. The pre-change rect is the visual
   *     position the box had a moment ago (small tile or big fill).
   *   - Last: read here, *after* Angular has applied the new bindings, so
   *     the box now sits in its new layout (big fill ↔ small tile).
   *   - Invert: compose a transform that maps the new layout back onto the
   *     old visual rect — that's the animation's starting keyframe.
   *   - Play: animate the transform back to identity, so the box visually
   *     glides from old rect to new rect while its true layout is already
   *     final.
   */
  private applyFlip(): void {
    const el = this.boxRef?.nativeElement;
    if (!el) {
      return;
    }
    const oldRect = this.state.consumePrePathRect(this.node.id);
    const newRect = el.getBoundingClientRect();
    if (!oldRect || newRect.width === 0 || newRect.height === 0) {
      return;
    }

    const sx = oldRect.width / newRect.width;
    const sy = oldRect.height / newRect.height;

    /*
     * Uniform scale prevents the visible "twist" / "shear" effect on text
     * and other descendants of the FLIPped box: with `scale(sx, sy)` where
     * sx ≠ sy, every glyph is stretched asymmetrically in x and y during
     * the animation, which the eye reads as the text wobbling. We use the
     * geometric mean so the area of the scaled-down box at t=0 matches the
     * area of the original grid cell — visually the closest equivalent.
     *
     * The trade-off is that the scaled box no longer fits the grid cell
     * exactly at t=0; we re-center it on the grid cell's center so the
     * mismatch is symmetric on all four sides (a few pixels, imperceptible
     * in practice).
     */
    const s = Math.sqrt(sx * sy);
    const oldCenterX = oldRect.left + oldRect.width / 2;
    const oldCenterY = oldRect.top + oldRect.height / 2;
    const dx = oldCenterX - newRect.left - (newRect.width * s) / 2;
    const dy = oldCenterY - newRect.top - (newRect.height * s) / 2;

    const stillEnough =
      Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(s - 1) < 0.005;
    if (stillEnough) {
      return;
    }

    this.currentAnimation?.cancel();
    this.currentAnimation = el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${s})`,
          transformOrigin: 'top left',
        },
        {
          transform: 'translate(0, 0) scale(1)',
          transformOrigin: 'top left',
        },
      ],
      {
        duration: UNIQ_FLIP_MS,
        easing: UNIQ_FLIP_EASE,
        fill: 'both',
      },
    );

    const anim = this.currentAnimation;
    anim.finished
      .then(() => {
        if (this.currentAnimation === anim) {
          anim.cancel();
          this.currentAnimation = null;
        }
      })
      .catch(() => {
        /* cancelled — nothing to do */
      });
  }

  /**
   * Triggers animate.css's `jackInTheBox` keyframes on this tile.
   *
   * We do this imperatively (via inline `style.animation`) rather than by
   * toggling the `animate__animated animate__jackInTheBox` classes, because:
   *
   *   1. In Uniq DOM mode the tile is never destroyed/recreated, so a
   *      class-based approach would need a remove-reflow-readd trick to
   *      replay the keyframes on every "show", which mixes class state
   *      with animation state.
   *   2. We need each tile to start at a different delay (the stagger),
   *      which is awkward to express as a single CSS class.
   *
   * `animation-fill-mode: both` makes the initial keyframe (opacity 0,
   * scaled down, rotated) take effect during the `delay` phase. afterNextRender
   * runs before paint, so setting `style.animation` here means the very first
   * painted frame already shows the tile at its starting keyframe — no
   * "fully visible then snap to invisible" flicker.
   */
  private playJackInTheBox(): void {
    const el = this.boxRef?.nativeElement;
    if (!el) {
      return;
    }
    if (this.jackAnimationEndHandler) {
      el.removeEventListener('animationend', this.jackAnimationEndHandler);
      this.jackAnimationEndHandler = null;
    }
    /*
     * Clear any previous animation and force a reflow so the browser sees a
     * fresh `animation` property and restarts the keyframes from frame zero,
     * even when the same tile re-triggers (e.g. user zooms in then out then
     * in again on the same branch).
     */
    el.style.animation = 'none';
    void el.offsetWidth;
    const delay = UNIQ_JACK_BASE_DELAY_MS + this.indexFromParent * UNIQ_JACK_STAGGER_MS;
    el.style.animation = `jackInTheBox ${UNIQ_JACK_MS}ms ${delay}ms both`;

    const onEnd = (event: AnimationEvent) => {
      if (event.animationName !== 'jackInTheBox') {
        return;
      }
      el.removeEventListener('animationend', onEnd);
      this.jackAnimationEndHandler = null;
      el.style.animation = '';
    };
    this.jackAnimationEndHandler = onEnd;
    el.addEventListener('animationend', onEnd);
  }
}
