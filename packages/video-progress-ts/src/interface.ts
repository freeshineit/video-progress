/**
 * 公共类型定义模块。
 *
 * 该文件集中声明对外暴露的接口，包括组件的初始化参数
 * {@link VideoProgressOptions} 与主题配置 {@link VideoProgressTheme}。
 *
 * @packageDocumentation
 */

/* =========================================================================
 * Types
 * ========================================================================= */

/**
 * 进度条主题配置。
 *
 * 所有字段都会映射为对应的 CSS 自定义属性（CSS Variables），
 * 在运行时直接作用于组件根元素，因此可以与原生 CSS 主题方案无缝集成。
 *
 * @remarks
 * 颜色字段支持任何合法的 CSS 颜色值（如 `"#fff"`、`"rgba(0,0,0,.5)"`、`"red"` 等）。
 *
 * @example
 * ```ts
 * const theme: VideoProgressTheme = {
 *   primary: "#ff5722",
 *   buffer: "rgba(255, 255, 255, 0.4)",
 *   background: "rgba(255, 255, 255, 0.1)",
 *   thumb: "#ffffff",
 *   height: 6,
 * };
 * ```
 */
export interface VideoProgressTheme {
  /**
   * 已播放部分的颜色。
   *
   * 对应 CSS 变量：`--vp-primary`。
   */
  primary?: string;

  /**
   * 缓冲（已加载）部分的颜色。
   *
   * 对应 CSS 变量：`--vp-buffer`。
   */
  buffer?: string;

  /**
   * 进度条底色（轨道背景色）。
   *
   * 对应 CSS 变量：`--vp-background`。
   */
  background?: string;

  /**
   * 拖拽手柄（thumb）的颜色。
   *
   * 对应 CSS 变量：`--vp-thumb`。
   */
  thumb?: string;

  /**
   * 轨道高度。
   *
   * - 传入 `number` 时，单位默认为 `px`；
   * - 传入 `string` 时，需自带单位，例如 `"4px"`、`"0.25rem"`。
   *
   * 对应 CSS 变量：`--vp-height`。
   */
  height?: string | number;
}

/**
 * 创建 {@link VideoProgress} 实例时的初始化参数。
 *
 * @remarks
 * - `container` 为唯一必填字段；
 * - 所有时间相关字段（`currentTime`、`duration`、`bufferTime`）单位均为 **秒**；
 * - 回调函数均为可选，未传入时不会被调用。
 *
 * @example
 * ```ts
 * const options: VideoProgressOptions = {
 *   container: document.getElementById("progress")!,
 *   duration: 300,
 *   currentTime: 30,
 *   bufferTime: 80,
 *   onSeek: (t) => video.currentTime = t,
 * };
 * ```
 */
export interface VideoProgressOptions {
  /**
   * 挂载容器，可以是 `HTMLElement` 实例或 CSS 选择器字符串。
   *
   * @remarks
   * 当传入字符串时，内部使用 `document.querySelector` 查找；若找不到将抛出错误。
   */
  container: HTMLElement | string;

  /**
   * 当前播放时间（秒）。
   *
   * @defaultValue `0`
   */
  currentTime?: number;

  /**
   * 视频总时长（秒）。
   *
   * @defaultValue `0`
   */
  duration?: number;

  /**
   * 已缓冲（已加载）的时间（秒）。
   *
   * @defaultValue `0`
   */
  bufferTime?: number;

  /**
   * 追加到根元素上的自定义 className，便于自定义样式覆盖。
   *
   * @defaultValue `""`
   */
  className?: string;

  /**
   * 是否禁用交互（鼠标、触摸、键盘均不响应）。
   *
   * @defaultValue `false`
   */
  disabled?: boolean;

  /**
   * 鼠标悬浮时是否显示时间提示气泡。
   *
   * @defaultValue `true`
   */
  showTooltip?: boolean;

  /**
   * 是否显示时间标签（当前时间 / 总时长）。
   *
   * @defaultValue `true`
   */
  showTime?: boolean;

  /**
   * 预设尺寸。
   *
   * - `"sm"`：小尺寸；
   * - `"md"`：中等尺寸（默认）；
   * - `"lg"`：大尺寸。
   *
   * @defaultValue `"md"`
   */
  size?: "sm" | "md" | "lg";

  /**
   * 主题覆写，最终会写入到根元素的 CSS 自定义属性上。
   *
   * @see {@link VideoProgressTheme}
   */
  theme?: VideoProgressTheme;

  /**
   * 自定义时间格式化函数。
   *
   * 接收以秒为单位的时间，返回格式化后的字符串（例如 `"01:23"`）。
   *
   * @param time - 待格式化的时间（秒）
   * @returns 格式化后的字符串
   *
   * @defaultValue 内置的默认格式化（`mm:ss` 或 `hh:mm:ss`）
   */
  formatTime?: (time: number) => string;

  // ── Callbacks ──

  /**
   * 拖拽开始时触发（`mousedown` / `touchstart`）。
   */
  onSeekStart?: () => void;

  /**
   * 拖拽过程中持续触发（连续回调）。
   *
   * @param time - 当前指针映射到的目标时间（秒）
   */
  onSeek?: (time: number) => void;

  /**
   * 拖拽结束时触发（`mouseup` / `touchend` 或键盘交互完成）。
   *
   * @param time - 拖拽最终落点对应的时间（秒）
   */
  onSeekEnd?: (time: number) => void;

  /**
   * 鼠标在轨道上移动时触发。
   *
   * @param time - 当前鼠标位置对应的时间（秒）
   * @param e - 原始 `MouseEvent`，可用于获取坐标等信息
   */
  onHover?: (time: number, e: MouseEvent) => void;

  /**
   * 鼠标离开轨道时触发。
   */
  onHoverEnd?: () => void;

  /**
   * 无障碍标签（`aria-label`），用于辅助技术朗读。
   *
   * @defaultValue `"Video progress"`
   */
  ariaLabel?: string;
}
