/**
 * @packageDocumentation
 *
 * `videoprogress` —— 一个轻量、零依赖的视频进度条组件。
 *
 * 该模块作为整个包的入口，导出 {@link VideoProgress} 类作为默认导出，
 * 同时重新导出公共类型 {@link VideoProgressOptions} 与 {@link VideoProgressTheme}。
 *
 * @example
 * ```ts
 * import VideoProgress, { VideoProgressOptions } from "videoprogress";
 *
 * const vp = new VideoProgress({
 *   container: "#progress",
 *   duration: 120,
 *   onSeekEnd: (t) => console.log("seeked to", t),
 * });
 * ```
 */

export type { VideoProgressOptions, VideoProgressTheme } from "./interface";

import VideoProgress from "./video-progress";

export default VideoProgress;
