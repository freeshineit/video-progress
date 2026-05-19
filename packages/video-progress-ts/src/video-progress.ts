/**
 * 视频进度条核心组件实现。
 *
 * 本文件导出 {@link VideoProgress} 类，封装了：
 * - DOM 结构构建与挂载；
 * - 鼠标 / 触摸 / 键盘交互；
 * - 拖拽（seek）状态机与回调；
 * - 主题、尺寸、ARIA 属性等动态渲染。
 *
 * @packageDocumentation
 */

/* =========================================================================
 * VideoProgress Class
 * ========================================================================= */

import type { VideoProgressOptions, VideoProgressTheme } from "./interface";

/**
 * 一个轻量、零依赖、可主题化的视频进度条组件。
 *
 * @remarks
 * - 通过构造函数挂载到指定容器，并在内部维护 DOM 与事件；
 * - 不直接控制视频播放，业务方需要在回调（如 {@link VideoProgressOptions.onSeek}）中
 *   将时间同步到自己的播放器；
 * - 调用 {@link VideoProgress.destroy} 可以彻底清理 DOM 与所有事件监听。
 *
 * @example
 * ```ts
 * const vp = new VideoProgress({
 *   container: "#progress",
 *   duration: video.duration,
 *   onSeekEnd: (t) => { video.currentTime = t; },
 * });
 *
 * video.addEventListener("timeupdate", () => {
 *   vp.currentTime = video.currentTime;
 * });
 * ```
 */
class VideoProgress {
  /* ── Options / State ── */

  /** 当前播放时间（秒）。 */
  private _currentTime: number;
  /** 视频总时长（秒）。 */
  private _duration: number;
  /** 已缓冲时间（秒）。 */
  private _bufferTime: number;
  /** 是否禁用交互。 */
  private _disabled: boolean;
  /** 是否显示悬浮 tooltip。 */
  private _showTooltip: boolean;
  /** 是否显示时间标签。 */
  private _showTime: boolean;
  /** 预设尺寸：`sm` | `md` | `lg`。 */
  private _size: "sm" | "md" | "lg";
  /** 主题配置（映射为 CSS 变量）。 */
  private _theme: VideoProgressTheme;
  /** 时间格式化函数。 */
  private _formatTime: (time: number) => string;
  /** 用户传入的自定义 className。 */
  private _className: string;
  /** 无障碍标签。 */
  private _ariaLabel: string;

  /* ── Callbacks ── */

  /** 拖拽开始回调。 */
  private _onSeekStart?: () => void;
  /** 拖拽过程中持续回调。 */
  private _onSeek?: (time: number) => void;
  /** 拖拽结束回调。 */
  private _onSeekEnd?: (time: number) => void;
  /** 鼠标悬浮回调。 */
  private _onHover?: (time: number, e: MouseEvent) => void;
  /** 鼠标离开回调。 */
  private _onHoverEnd?: () => void;

  /* ── DOM Elements ── */

  /** 解析后的挂载容器。 */
  private _root: HTMLElement;
  /** 组件根元素（`.vp-container`）。 */
  private _el: HTMLDivElement;
  /** 可点击 / 可聚焦的轨道（含 ARIA 属性）。 */
  private _track: HTMLDivElement;
  /** 轨道底色条。 */
  private _rail: HTMLDivElement;
  /** 缓冲条。 */
  private _bufferBar: HTMLDivElement;
  /** 已播放进度条。 */
  private _playedBar: HTMLDivElement;
  /** 拖拽手柄（thumb）。 */
  private _thumb: HTMLDivElement;
  /** 鼠标悬浮指示线。 */
  private _hoverLine: HTMLDivElement;
  /** 悬浮时间气泡。 */
  private _tooltip: HTMLDivElement;
  /** 悬浮气泡内的文本节点。 */
  private _tooltipText: HTMLSpanElement;
  /** 时间标签容器（包含当前时间 / 分隔符 / 总时长）。 */
  private _timeContainer: HTMLDivElement;
  /** 显示当前时间的 `<span>`。 */
  private _timeCurrent: HTMLSpanElement;
  /** 时间分隔符 `<span>`（默认 `/`）。 */
  private _timeSep: HTMLSpanElement;
  /** 显示总时长的 `<span>`。 */
  private _timeDuration: HTMLSpanElement;

  /* ── Internal state ── */

  /** 当前是否处于拖拽中。 */
  private _dragging = false;
  /** 上一次拖拽到的时间，供拖拽结束时回调使用。 */
  private _lastSeeked = 0;
  /** 鼠标是否在轨道上方悬浮。 */
  private _hovering = false;
  /** 轨道是否处于聚焦状态。 */
  private _focused = false;
  /** 实例是否已销毁。 */
  private _destroyed = false;

  /* ── Bound handlers (for cleanup) ── */

  /** 文档级 `mousemove` 处理函数（已绑定 `this`）。 */
  private _boundMouseMove: (e: MouseEvent) => void;
  /** 文档级 `mouseup` 处理函数（已绑定 `this`）。 */
  private _boundMouseUp: () => void;
  /** 文档级 `touchmove` 处理函数（已绑定 `this`）。 */
  private _boundTouchMove: (e: TouchEvent) => void;
  /** 文档级 `touchend` 处理函数（已绑定 `this`）。 */
  private _boundTouchEnd: () => void;

  /**
   * 创建一个 {@link VideoProgress} 实例。
   *
   * 构造函数会执行：
   * 1. 解析并合并默认选项；
   * 2. 解析挂载容器（字符串选择器或元素引用）；
   * 3. 构建内部 DOM 并缓存所有需要操作的子节点；
   * 4. 绑定鼠标 / 触摸 / 键盘 / 焦点等事件；
   * 5. 将根元素插入容器并执行首次渲染。
   *
   * @param options - 初始化选项，详见 {@link VideoProgressOptions}
   *
   * @throws 当 `options.container` 是字符串且无法在 DOM 中找到对应节点时抛出错误。
   */
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
      formatTime = VideoProgress._defaultFormatTime,
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
      if (!el)
        throw new Error(`VideoProgress: container "${container}" not found`);
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
    this._hoverLine = this._el.querySelector(
      ".vp-hover-line",
    ) as HTMLDivElement;
    this._tooltip = this._el.querySelector(".vp-tooltip") as HTMLDivElement;
    this._tooltipText = this._el.querySelector(
      ".vp-tooltip-text",
    ) as HTMLSpanElement;
    this._timeContainer = this._el.querySelector(".vp-time") as HTMLDivElement;
    this._timeCurrent = this._el.querySelector(
      ".vp-time-current",
    ) as HTMLSpanElement;
    this._timeSep = this._el.querySelector(".vp-time-sep") as HTMLSpanElement;
    this._timeDuration = this._el.querySelector(
      ".vp-time-duration",
    ) as HTMLSpanElement;

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

  /**
   * 当前播放时间（秒）。
   *
   * 赋值后会立即触发一次内部重渲染。
   */
  get currentTime(): number {
    return this._currentTime;
  }
  set currentTime(v: number) {
    this._currentTime = v;
    this._render();
  }

  /**
   * 视频总时长（秒）。
   *
   * 赋值后会立即触发一次内部重渲染。
   */
  get duration(): number {
    return this._duration;
  }
  set duration(v: number) {
    this._duration = v;
    this._render();
  }

  /**
   * 已缓冲时间（秒）。
   *
   * 赋值后会立即触发一次内部重渲染。
   */
  get bufferTime(): number {
    return this._bufferTime;
  }
  set bufferTime(v: number) {
    this._bufferTime = v;
    this._render();
  }

  /**
   * 是否禁用组件交互。
   *
   * 设置为 `true` 时，鼠标 / 触摸 / 键盘事件均会被忽略，
   * 同时根元素会附加 `vp-disabled` 类、轨道的 `tabindex` 也会变为 `-1`。
   */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(v: boolean) {
    this._disabled = v;
    this._render();
  }

  /**
   * 一次性更新多个选项。
   *
   * 仅会更新传入字段，未传入的字段保持原值；
   * 全部更新完成后执行一次重渲染。
   *
   * @param opts - 待更新的字段集合（不包含 `container`）
   *
   * @example
   * ```ts
   * vp.update({
   *   currentTime: 30,
   *   bufferTime: 60,
   *   theme: { primary: "#f00" },
   * });
   * ```
   */
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

  /**
   * 销毁组件，从 DOM 中移除根元素并解绑所有事件。
   *
   * @remarks
   * - 重复调用是安全的，第二次起会直接返回；
   * - 销毁后再访问 / 赋值属性不会抛错，但内部的 {@link _render} 会被短路，
   *   不会再产生任何副作用。
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._detachEvents();
    this._el.remove();
  }

  /**
   * 获取组件根 DOM 元素。
   *
   * 业务方可通过它做样式覆盖、定位测量或额外事件监听等操作，
   * 但不建议直接修改其内部结构。
   */
  get element(): HTMLDivElement {
    return this._el;
  }

  /* =====================================================================
   *  DOM Creation
   * ===================================================================== */

  /**
   * 创建组件的初始 DOM 结构。
   *
   * 结构如下：
   * ```html
   * <div class="vp-container">
   *   <div class="vp-track" role="slider" tabindex="0">
   *     <div class="vp-rail"></div>
   *     <div class="vp-buffer"></div>
   *     <div class="vp-played"></div>
   *     <div class="vp-thumb"></div>
   *     <div class="vp-hover-line"></div>
   *     <div class="vp-tooltip"><span class="vp-tooltip-text"></span></div>
   *   </div>
   *   <div class="vp-time">
   *     <span class="vp-time-current"></span>
   *     <span class="vp-time-sep">/</span>
   *     <span class="vp-time-duration"></span>
   *   </div>
   * </div>
   * ```
   *
   * @returns 组件根 `HTMLDivElement`
   *
   * @internal
   */
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

  /**
   * 根据当前内部状态刷新 DOM。
   *
   * 包括：
   * - 根元素的 className 列表（禁用 / 聚焦 / 悬浮 / 尺寸 / 自定义）；
   * - 主题相关的 CSS 自定义属性；
   * - 轨道上的 ARIA 属性（`aria-valuemax`、`aria-valuenow` 等）；
   * - 已播 / 缓冲条宽度与 thumb 位置；
   * - 时间标签的显示与文本。
   *
   * 销毁后调用本方法不会有任何副作用。
   *
   * @internal
   */
  private _render(): void {
    if (this._destroyed) return;

    const safeDur = this._duration > 0 ? this._duration : 0;
    const playedPct =
      safeDur > 0 ? VideoProgress._clamp(this._currentTime / safeDur, 0, 1) * 100 : 0;
    const bufPct =
      safeDur > 0 ? VideoProgress._clamp(this._bufferTime / safeDur, 0, 1) * 100 : 0;

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
    if (this._theme.primary)
      this._el.style.setProperty("--vp-primary", this._theme.primary);
    if (this._theme.buffer)
      this._el.style.setProperty("--vp-buffer", this._theme.buffer);
    if (this._theme.background)
      this._el.style.setProperty("--vp-background", this._theme.background);
    if (this._theme.thumb)
      this._el.style.setProperty("--vp-thumb", this._theme.thumb);
    if (this._theme.height !== undefined) {
      const h =
        typeof this._theme.height === "number"
          ? `${this._theme.height}px`
          : this._theme.height;
      this._el.style.setProperty("--vp-height", h);
    }

    // Track ARIA
    this._track.setAttribute("aria-label", this._ariaLabel);
    this._track.setAttribute("aria-valuemax", String(safeDur));
    this._track.setAttribute("aria-valuenow", String(this._currentTime));
    this._track.setAttribute(
      "aria-valuetext",
      this._formatTime(this._currentTime),
    );
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

  /**
   * 绑定所有内部及全局事件监听。
   *
   * @remarks
   * - 元素级事件直接绑定到对应节点；
   * - 拖拽过程中的 `mousemove` / `mouseup` 与 `touchmove` / `touchend`
   *   绑定到 `document` 上，保证拖出元素后仍能跟踪。
   *
   * @internal
   */
  private _attachEvents(): void {
    // Track events
    this._track.addEventListener("mousedown", this._onTrackMouseDown);
    this._track.addEventListener("touchstart", this._onTrackTouchStart, {
      passive: true,
    });
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
    document.addEventListener("touchmove", this._boundTouchMove, {
      passive: true,
    });
    document.addEventListener("touchend", this._boundTouchEnd);
  }

  /**
   * 解绑由 {@link _attachEvents} 注册的所有事件，
   * 仅在 {@link destroy} 中调用。
   *
   * @internal
   */
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

  /**
   * 根据客户端 X 坐标计算对应的目标时间，并触发 {@link _onSeek}。
   *
   * @param clientX - 鼠标 / 触摸事件的 `clientX`
   *
   * @internal
   */
  private _seekAt(clientX: number): void {
    const safeDur = this._duration > 0 ? this._duration : 0;
    if (safeDur <= 0) return;
    const t = VideoProgress._clientToRatio(clientX, this._track) * safeDur;
    this._lastSeeked = t;
    this._onSeek?.(t);
  }

  /**
   * 进入拖拽状态：标记 `_dragging`、调用 `onSeekStart`，
   * 并立即按当前指针位置 seek 一次；同时禁用文本选中、修改鼠标样式。
   *
   * 在 `disabled` 为 `true` 时直接返回，不进入拖拽。
   *
   * @param clientX - 拖拽起始时的 `clientX`
   *
   * @internal
   */
  private _beginDrag(clientX: number): void {
    if (this._disabled) return;
    this._dragging = true;
    this._onSeekStart?.();
    this._seekAt(clientX);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  /**
   * 退出拖拽状态：重置标记、恢复 `<body>` 样式，
   * 并使用最后一次拖到的时间触发 {@link _onSeekEnd}。
   *
   * 若并未处于拖拽中，则直接返回。
   *
   * @internal
   */
  private _endDrag(): void {
    if (!this._dragging) return;
    this._dragging = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    this._onSeekEnd?.(this._lastSeeked);
  }

  /* ── Track handlers ── */

  /**
   * 轨道上的 `mousedown` 处理：仅响应主键，且组件未禁用时进入拖拽。
   *
   * @internal
   */
  private _onTrackMouseDown = (e: MouseEvent): void => {
    if (this._disabled || e.button !== 0) return;
    e.preventDefault();
    this._beginDrag(e.clientX);
  };

  /**
   * 轨道上的 `touchstart` 处理：取首个触点的 `clientX` 进入拖拽。
   *
   * @internal
   */
  private _onTrackTouchStart = (e: TouchEvent): void => {
    if (this._disabled) return;
    this._beginDrag(e.touches[0]?.clientX ?? 0);
  };

  /**
   * thumb 上的 `mousedown` 处理：阻止冒泡以避免触发轨道的 mousedown，
   * 然后进入拖拽。
   *
   * @internal
   */
  private _onThumbMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this._beginDrag(e.clientX);
  };

  /* ── Global drag handlers ── */

  /**
   * 文档级 `mousemove` 处理：仅在拖拽中跟随更新 seek。
   *
   * @internal
   */
  private _onDocMouseMove(e: MouseEvent): void {
    if (!this._dragging) return;
    this._seekAt(e.clientX);
  }

  /**
   * 文档级 `mouseup` / `touchend` 处理：结束拖拽。
   *
   * @internal
   */
  private _onDocMouseUp(): void {
    this._endDrag();
  }

  /**
   * 文档级 `touchmove` 处理：仅在拖拽中跟随首个触点更新 seek。
   *
   * @internal
   */
  private _onDocTouchMove(e: TouchEvent): void {
    if (!this._dragging) return;
    this._seekAt(e.touches[0]?.clientX ?? 0);
  }

  /* =====================================================================
   *  Hover
   * ===================================================================== */

  /**
   * 鼠标进入容器：标记悬浮状态并刷新视图。
   *
   * @internal
   */
  private _onMouseEnter = (): void => {
    if (this._disabled) return;
    this._hovering = true;
    this._render();
  };

  /**
   * 鼠标离开容器：清除悬浮状态、隐藏指示线与 tooltip，
   * 触发 {@link _onHoverEnd}，最后刷新视图。
   *
   * @internal
   */
  private _onMouseLeave = (): void => {
    this._hovering = false;
    this._hoverLine.style.display = "none";
    this._tooltip.style.display = "none";
    this._onHoverEnd?.();
    this._render();
  };

  /**
   * 鼠标在容器内移动：
   * - 更新悬浮指示线位置；
   * - 在开启 tooltip 时同步 tooltip 位置与文本；
   * - 触发 {@link _onHover} 回调。
   *
   * @internal
   */
  private _onMouseMove = (e: MouseEvent): void => {
    if (this._disabled) return;
    const ratio = VideoProgress._clientToRatio(e.clientX, this._track);
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

  /**
   * 键盘交互处理：
   *
   * - `ArrowRight` / `ArrowUp`：前进一个步长；
   * - `ArrowLeft` / `ArrowDown`：后退一个步长；
   * - `Home`：跳到 0；
   * - `End`：跳到总时长；
   *
   * 步长按 `max(1, round(duration / 100))` 计算，最小为 1 秒。
   * 每次有效操作都会同时触发 {@link _onSeek} 与 {@link _onSeekEnd}。
   *
   * @internal
   */
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

  /**
   * 轨道获得焦点：标记并触发渲染（用于显示聚焦样式）。
   *
   * @internal
   */
  private _onFocus = (): void => {
    this._focused = true;
    this._render();
  };

  /**
   * 轨道失去焦点：清除聚焦状态并触发渲染。
   *
   * @internal
   */
  private _onBlur = (): void => {
    this._focused = false;
    this._render();
  };

  /* =====================================================================
   *  Static helpers (private)
   * ===================================================================== */

  /**
   * 默认时间格式化函数。
   *
   * 将以秒为单位的时间转换为可读字符串：
   * - 不足 1 小时输出 `mm:ss`；
   * - 大于等于 1 小时输出 `hh:mm:ss`；
   * - 非有限数或负数返回 `"00:00"`。
   *
   * @param time - 待格式化的时间（秒）
   * @returns 格式化后的字符串
   *
   * @example
   * ```ts
   * VideoProgress["_defaultFormatTime"](65);   // "01:05"
   * VideoProgress["_defaultFormatTime"](3725); // "01:02:05"
   * ```
   *
   * @internal
   */
  private static _defaultFormatTime(time: number): string {
    if (!isFinite(time) || time < 0) return "00:00";
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    const p = (n: number) => String(n).padStart(2, "0");
    if (h > 0) return `${p(h)}:${p(m)}:${p(s)}`;
    return `${p(m)}:${p(s)}`;
  }

  /**
   * 将数值限制在指定区间 `[lo, hi]` 内。
   *
   * @param v - 待裁剪的原始值
   * @param lo - 区间下界（包含）
   * @param hi - 区间上界（包含）
   * @returns 满足 `lo <= 返回值 <= hi` 的值
   *
   * @internal
   */
  private static _clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
  }

  /**
   * 将客户端 X 坐标（如 `MouseEvent.clientX`）转换为目标元素内的相对比例。
   *
   * 计算方式：`(clientX - rect.left) / rect.width`，并使用 {@link VideoProgress._clamp}
   * 限制结果在 `[0, 1]` 之间。
   *
   * @param clientX - 鼠标 / 触摸事件的客户端横坐标
   * @param el - 参照元素
   * @returns 元素内的相对比例，范围 `[0, 1]`
   *
   * @internal
   */
  private static _clientToRatio(clientX: number, el: HTMLElement): number {
    const r = el.getBoundingClientRect();
    return VideoProgress._clamp((clientX - r.left) / r.width, 0, 1);
  }
}

export default VideoProgress;
