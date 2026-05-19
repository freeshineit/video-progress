/**
 * UMD / 浏览器全局打包入口。
 *
 * 仅用于 Rollup 构建时生成独立的脚本产物，
 * 在该模式下默认导出会挂载到全局变量 `VideoProgress` 上。
 *
 * @packageDocumentation
 */

import VideoProgress from ".";

export default VideoProgress;
