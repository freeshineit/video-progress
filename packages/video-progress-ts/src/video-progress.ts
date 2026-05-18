/* =========================================================================
 * Types
 * ========================================================================= */

export interface VideoProgressTheme {
  /** Played portion color */
  primary?: string;
  /** Buffered portion color */
  buffer?: string;
  /** Background rail color */
  background?: string;
  /** Thumb knob color */
  thumb?: string;
  /** Track height */
  height?: string | number;
}

export interface VideoProgressOptions {
  /** Container element or CSS selector to mount into */
  container: HTMLElement | string;
  /** Current playback time (seconds) */
  currentTime?: number;
  /** Total duration (seconds) */
  duration?: number;
  /** Buffered / loaded time (seconds) */
  bufferTime?: number;
  /** Additional className for the root element */
  className?: string;
  /** Disable interaction */
  disabled?: boolean;
  /** Show hover time tooltip */
  showTooltip?: boolean;
  /** Show the time labels (currentTime / duration) */
  showTime?: boolean;
  /** Preset size */
  size?: "sm" | "md" | "lg";
  /** Theme override — maps to CSS variables */
  theme?: VideoProgressTheme;
  /** Custom time formatter: seconds → string */
  formatTime?: (time: number) => string;

  // ── Callbacks ──
  /** Fires when seeking starts (mousedown / touchstart) */
  onSeekStart?: () => void;
  /** Fires continuously during a seek */
  onSeek?: (time: number) => void;
  /** Fires when seeking ends (mouseup / touchend) */
  onSeekEnd?: (time: number) => void;
  /** Fires as the mouse moves over the track */
  onHover?: (time: number, e: MouseEvent) => void;
  /** Fires when the mouse leaves the track */
  onHoverEnd?: () => void;

  /** Accessibility label */
  ariaLabel?: string;
}

/* =========================================================================
 * Helpers
 * ========================================================================= */

export function defaultFormatTime(time: number): string {
  if (!isFinite(time) || time < 0) return "00:00";
  const h = Math.floor(time / 3600);
  const m = Math.floor((time % 3600) / 60);
  const s = Math.floor(time % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${p(h)}:${p(m)}:${p(s)}`;
  return `${p(m)}:${p(s)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clientToRatio(clientX: number, el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  return clamp((clientX - r.left) / r.width, 0, 1);
}

/* =========================================================================
 * VideoProgress Class
 * ========================================================================= */

export class VideoProgress {
  /* ── Options / State ── */
  private _currentTime: number;
  private _duration: number;
  private _bufferTime: number;
  private _disabled: boolean;
  private _showTooltip: boolean;
  private _showTime: boolean;
  private _size: "sm" | "md" | "lg";
  private _theme: VideoProgressTheme;
  private _formatTime: (time: number) => string;
  private _className: string;
  private _ariaLabel: string;

  /* ── Callbacks ── */
  private _onSeekStart?: () => void;
  private _onSeek?: (time: number) => void;
  private _onSeekEnd?: (time: number) => void;
  private _onHover?: (time: number, e: MouseEvent) => void;
  private _onHoverEnd?: () => void;

  /* ── DOM Elements ── */
  private _root: HTMLElement;
  private _el: HTMLDivElement;
  private _track: HTMLDivElement;
  private _rail: HTMLDivElement;
  private _bufferBar: HTMLDivElement;
  private _playedBar: HTMLDivElement;
  private _thumb: HTMLDivElement;
  private _hoverLine: HTMLDivElement;
  private _tooltip: HTMLDivElement;
  private _tooltipText: HTMLSpanElement;
  private _timeContainer: HTMLDivElement;
  private _timeCurrent: HTMLSpanElement;
  private _timeSep: HTMLSpanElement;
  private _timeDuration: HTMLSpanElement;

  /* ── Internal state ── */
  private _dragging = false;
  private _lastSeeked = 0;
  private _hovering = false;
  private _focused = false;
  private _destroyed = false;

  /* ── Bound handlers (for cleanup) ── */
  private _boundMouseMove: (e: MouseEvent) => void;
  private _boundMouseUp: () => void;
  private _boundTouchMove: (e: TouchEvent) => void;
  private _boundTouchEnd: () => void;

  constructor(options: VideoProgressOptions) {
    const {
      container,
      currentTime = 0,
      duration = 0,
      bufferTime = 0,
      className = "",
      disabled = false,
      showTooltip = true,
      showTime = true,
      size = "md",
      theme = {},
      formatTime = defaultFormatTime,
      onSeekStart,
      onSeek,
      onSeekEnd,
      onHover,
      onHoverEnd,
      ariaLabel = "Video progress",
    } = options;

    this._currentTime = currentTime;
    this._duration = duration;
    this._bufferTime = bufferTime;
    this._disabled = disabled;
    this._showTooltip = showTooltip;
    this._showTime = showTime;
    this._size = size;
    this._theme = theme;
    this._formatTime = formatTime;
    this._className = className;
    this._ariaLabel = ariaLabel;

    this._onSeekStart = onSeekStart;
    this._onSeek = onSeek;
    this._onSeekEnd = onSeekEnd;
    this._onHover = onHover;
    this._onHoverEnd = onHoverEnd;

    // Resolve container
    if (typeof container === "string") {
      const el = document.querySelector<HTMLElement>(container);
      if (!el) throw new Error(`VideoProgress: container "${container}" not found`);
      this._root = el;
    } else {
      this._root = container;
    }

    // Build DOM
    this._el = this._createElement();
    this._track = this._el.querySelector(".vp-track") as HTMLDivElement;
    this._rail = this._el.querySelector(".vp-rail") as HTMLDivElement;
    this._bufferBar = this._el.querySelector(".vp-buffer") as HTMLDivElement;
    this._playedBar = this._el.querySelector(".vp-played") as HTMLDivElement;
    this._thumb = this._el.querySelector(".vp-thumb") as HTMLDivElement;
    this._hoverLine = this._el.querySelector(".vp-hover-line") as HTMLDivElement;
    this._tooltip = this._el.querySelector(".vp-tooltip") as HTMLDivElement;
    this._tooltipText = this._el.querySelector(".vp-tooltip-text") as HTMLSpanElement;
    this._timeContainer = this._el.querySelector(".vp-time") as HTMLDivElement;
    this._timeCurrent = this._el.querySelector(".vp-time-current") as HTMLSpanElement;
    this._timeSep = this._el.querySelector(".vp-time-sep") as HTMLSpanElement;
    this._timeDuration = this._el.querySelector(".vp-time-duration") as HTMLSpanElement;

    // Bind global handlers
    this._boundMouseMove = this._onDocMouseMove.bind(this);
    this._boundMouseUp = this._onDocMouseUp.bind(this);
    this._boundTouchMove = this._onDocTouchMove.bind(this);
    this._boundTouchEnd = this._onDocMouseUp.bind(this);

    // Attach events
    this._attachEvents();

    // Mount
    this._root.appendChild(this._el);

    // Initial render
    this._render();
  }

  /* =====================================================================
   *  Public API
   * ===================================================================== */

  get currentTime(): number {
    return this._currentTime;
  }
  set currentTime(v: number) {
    this._currentTime = v;
    this._render();
  }

  get duration(): number {
    return this._duration;
  }
  set duration(v: number) {
    this._duration = v;
    this._render();
  }

  get bufferTime(): number {
    return this._bufferTime;
  }
  set bufferTime(v: number) {
    this._bufferTime = v;
    this._render();
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(v: boolean) {
    this._disabled = v;
    this._render();
  }

  /** Update multiple options at once */
  update(opts: Partial<Omit<VideoProgressOptions, "container">>): void {
    if (opts.currentTime !== undefined) this._currentTime = opts.currentTime;
    if (opts.duration !== undefined) this._duration = opts.duration;
    if (opts.bufferTime !== undefined) this._bufferTime = opts.bufferTime;
    if (opts.disabled !== undefined) this._disabled = opts.disabled;
    if (opts.showTooltip !== undefined) this._showTooltip = opts.showTooltip;
    if (opts.showTime !== undefined) this._showTime = opts.showTime;
    if (opts.size !== undefined) this._size = opts.size;
    if (opts.theme !== undefined) this._theme = opts.theme;
    if (opts.formatTime !== undefined) this._formatTime = opts.formatTime;
    if (opts.className !== undefined) this._className = opts.className;
    if (opts.ariaLabel !== undefined) this._ariaLabel = opts.ariaLabel;
    if (opts.onSeekStart !== undefined) this._onSeekStart = opts.onSeekStart;
    if (opts.onSeek !== undefined) this._onSeek = opts.onSeek;
    if (opts.onSeekEnd !== undefined) this._onSeekEnd = opts.onSeekEnd;
    if (opts.onHover !== undefined) this._onHover = opts.onHover;
    if (opts.onHoverEnd !== undefined) this._onHoverEnd = opts.onHoverEnd;
    this._render();
  }

  /** Remove the component and clean up all listeners */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._detachEvents();
    this._el.remove();
  }

  /** Get the root DOM element */
  get element(): HTMLDivElement {
    return this._el;
  }

  /* =====================================================================
   *  DOM Creation
   * ===================================================================== */

  private _createElement(): HTMLDivElement {
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="vp-track" tabindex="0" role="slider" aria-label="" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="" aria-disabled="false">
        <div class="vp-rail"></div>
        <div class="vp-buffer"></div>
        <div class="vp-played"></div>
        <div class="vp-thumb"></div>
        <div class="vp-hover-line" style="display:none;"></div>
        <div class="vp-tooltip" style="display:none;">
          <span class="vp-tooltip-text"></span>
        </div>
      </div>
      <div class="vp-time">
        <span class="vp-time-current"></span>
        <span class="vp-time-sep">/</span>
        <span class="vp-time-duration"></span>
      </div>
    `;
    return el;
  }

  /* =====================================================================
   *  Render / Update DOM
   * ===================================================================== */

  private _render(): void {
    if (this._destroyed) return;

    const safeDur = this._duration > 0 ? this._duration : 0;
    const playedPct = safeDur > 0 ? clamp(this._currentTime / safeDur, 0, 1) * 100 : 0;
    const bufPct = safeDur > 0 ? clamp(this._bufferTime / safeDur, 0, 1) * 100 : 0;

    // Root classes
    const classes = ["vp-container"];
    if (this._disabled) classes.push("vp-disabled");
    if (this._focused) classes.push("vp-focused");
    if (this._hovering) classes.push("vp-hovering");
    if (this._size === "sm") classes.push("vp-sm");
    if (this._size === "lg") classes.push("vp-lg");
    if (this._className) classes.push(this._className);
    this._el.className = classes.join(" ");

    // CSS variables (theme)
    this._el.style.cssText = "";
    if (this._theme.primary) this._el.style.setProperty("--vp-primary", this._theme.primary);
    if (this._theme.buffer) this._el.style.setProperty("--vp-buffer", this._theme.buffer);
    if (this._theme.background) this._el.style.setProperty("--vp-background", this._theme.background);
    if (this._theme.thumb) this._el.style.setProperty("--vp-thumb", this._theme.thumb);
    if (this._theme.height !== undefined) {
      const h = typeof this._theme.height === "number" ? `${this._theme.height}px` : this._theme.height;
      this._el.style.setProperty("--vp-height", h);
    }

    // Track ARIA
    this._track.setAttribute("aria-label", this._ariaLabel);
    this._track.setAttribute("aria-valuemax", String(safeDur));
    this._track.setAttribute("aria-valuenow", String(this._currentTime));
    this._track.setAttribute("aria-valuetext", this._formatTime(this._currentTime));
    this._track.setAttribute("aria-disabled", String(this._disabled));
    this._track.tabIndex = this._disabled ? -1 : 0;

    // Bars
    this._bufferBar.style.width = `${bufPct}%`;
    this._playedBar.style.width = `${playedPct}%`;
    this._thumb.style.left = `${playedPct}%`;

    // Time labels
    this._timeContainer.style.display = this._showTime ? "" : "none";
    this._timeCurrent.textContent = this._formatTime(this._currentTime);
    this._timeDuration.textContent = this._formatTime(safeDur);
  }

  /* =====================================================================
   *  Event Binding
   * ===================================================================== */

  private _attachEvents(): void {
    // Track events
    this._track.addEventListener("mousedown", this._onTrackMouseDown);
    this._track.addEventListener("touchstart", this._onTrackTouchStart, { passive: true });
    this._track.addEventListener("keydown", this._onKeyDown);
    this._track.addEventListener("focus", this._onFocus);
    this._track.addEventListener("blur", this._onBlur);

    // Thumb
    this._thumb.addEventListener("mousedown", this._onThumbMouseDown);

    // Container hover
    this._el.addEventListener("mouseenter", this._onMouseEnter);
    this._el.addEventListener("mouseleave", this._onMouseLeave);
    this._el.addEventListener("mousemove", this._onMouseMove);

    // Global drag listeners
    document.addEventListener("mousemove", this._boundMouseMove);
    document.addEventListener("mouseup", this._boundMouseUp);
    document.addEventListener("touchmove", this._boundTouchMove, { passive: true });
    document.addEventListener("touchend", this._boundTouchEnd);
  }

  private _detachEvents(): void {
    this._track.removeEventListener("mousedown", this._onTrackMouseDown);
    this._track.removeEventListener("touchstart", this._onTrackTouchStart);
    this._track.removeEventListener("keydown", this._onKeyDown);
    this._track.removeEventListener("focus", this._onFocus);
    this._track.removeEventListener("blur", this._onBlur);

    this._thumb.removeEventListener("mousedown", this._onThumbMouseDown);

    this._el.removeEventListener("mouseenter", this._onMouseEnter);
    this._el.removeEventListener("mouseleave", this._onMouseLeave);
    this._el.removeEventListener("mousemove", this._onMouseMove);

    document.removeEventListener("mousemove", this._boundMouseMove);
    document.removeEventListener("mouseup", this._boundMouseUp);
    document.removeEventListener("touchmove", this._boundTouchMove);
    document.removeEventListener("touchend", this._boundTouchEnd);
  }

  /* =====================================================================
   *  Drag Logic
   * ===================================================================== */

  private _seekAt(clientX: number): void {
    const safeDur = this._duration > 0 ? this._duration : 0;
    if (safeDur <= 0) return;
    const t = clientToRatio(clientX, this._track) * safeDur;
    this._lastSeeked = t;
    this._onSeek?.(t);
  }

  private _beginDrag(clientX: number): void {
    if (this._disabled) return;
    this._dragging = true;
    this._onSeekStart?.();
    this._seekAt(clientX);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  private _endDrag(): void {
    if (!this._dragging) return;
    this._dragging = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    this._onSeekEnd?.(this._lastSeeked);
  }

  /* ── Track handlers ── */

  private _onTrackMouseDown = (e: MouseEvent): void => {
    if (this._disabled || e.button !== 0) return;
    e.preventDefault();
    this._beginDrag(e.clientX);
  };

  private _onTrackTouchStart = (e: TouchEvent): void => {
    if (this._disabled) return;
    this._beginDrag(e.touches[0]?.clientX ?? 0);
  };

  private _onThumbMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this._beginDrag(e.clientX);
  };

  /* ── Global drag handlers ── */

  private _onDocMouseMove(e: MouseEvent): void {
    if (!this._dragging) return;
    this._seekAt(e.clientX);
  }

  private _onDocMouseUp(): void {
    this._endDrag();
  }

  private _onDocTouchMove(e: TouchEvent): void {
    if (!this._dragging) return;
    this._seekAt(e.touches[0]?.clientX ?? 0);
  }

  /* =====================================================================
   *  Hover
   * ===================================================================== */

  private _onMouseEnter = (): void => {
    if (this._disabled) return;
    this._hovering = true;
    this._render();
  };

  private _onMouseLeave = (): void => {
    this._hovering = false;
    this._hoverLine.style.display = "none";
    this._tooltip.style.display = "none";
    this._onHoverEnd?.();
    this._render();
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (this._disabled) return;
    const ratio = clientToRatio(e.clientX, this._track);
    const pct = ratio * 100;
    const safeDur = this._duration > 0 ? this._duration : 0;
    const t = ratio * safeDur;

    // Hover line
    this._hoverLine.style.display = "";
    this._hoverLine.style.left = `${pct}%`;

    // Tooltip
    if (this._showTooltip) {
      this._tooltip.style.display = "";
      this._tooltip.style.left = `${pct}%`;
      this._tooltipText.textContent = this._formatTime(t);
    }

    this._onHover?.(t, e);
  };

  /* =====================================================================
   *  Keyboard
   * ===================================================================== */

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (this._disabled) return;
    const safeDur = this._duration > 0 ? this._duration : 0;
    const step = safeDur > 0 ? Math.max(1, Math.round(safeDur / 100)) : 1;
    let t = this._currentTime;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        t = Math.min(this._currentTime + step, safeDur);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        t = Math.max(this._currentTime - step, 0);
        break;
      case "Home":
        e.preventDefault();
        t = 0;
        break;
      case "End":
        e.preventDefault();
        t = safeDur;
        break;
      default:
        return;
    }
    this._lastSeeked = t;
    this._onSeek?.(t);
    this._onSeekEnd?.(t);
  };

  /* =====================================================================
   *  Focus
   * ===================================================================== */

  private _onFocus = (): void => {
    this._focused = true;
    this._render();
  };

  private _onBlur = (): void => {
    this._focused = false;
    this._render();
  };
}
