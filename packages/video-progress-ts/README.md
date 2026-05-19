# videoprogress

> 一个轻量、零依赖、可主题化的视频进度条组件，使用 TypeScript 编写。

[![npm version](https://img.shields.io/npm/v/videoprogress.svg)](https://www.npmjs.com/package/videoprogress)
[![license](https://img.shields.io/npm/l/videoprogress.svg)](./LICENSE)

`videoprogress` 提供了一个原生 DOM 实现的视频进度条 UI，专注于**交互**与**渲染**，
不耦合任何具体的播放器实现。你可以把它接到 `<video>`、HLS、自研播放器或任何能给出
“当前时间 / 总时长 / 缓冲时间”的对象上。

## ✨ 特性

- 🪶 **零依赖**，产物体积小，CJS / ESM / UMD 三种格式
- 🎨 **可主题化**，所有颜色与尺寸都通过 CSS 自定义属性暴露
- 🖱 **完整交互**：鼠标拖拽、触摸、键盘（方向键 / Home / End）
- 💡 **悬浮提示**：可显示自定义格式化的时间气泡
- 📐 **三种预设尺寸**：`sm` / `md` / `lg`
- ♿ **无障碍**：原生 `role="slider"`、`aria-valuenow` 等属性
- 🧠 **TypeScript 友好**，自带类型声明与 TypeDoc 注释

## 📦 安装

```bash
npm install videoprogress
# 或
pnpm add videoprogress
# 或
yarn add videoprogress
```

## 🚀 快速开始

### ESM / TypeScript

```ts
import VideoProgress from "videoprogress";
import "videoprogress/dist/style/style.css";

const vp = new VideoProgress({
  container: "#progress",
  duration: 120,
  currentTime: 0,
  bufferTime: 30,
  onSeekEnd: (t) => {
    console.log("seek to", t);
  },
});
```

### 与 `<video>` 元素双向绑定

```ts
const video = document.querySelector<HTMLVideoElement>("#video")!;
const vp = new VideoProgress({
  container: "#progress",
  onSeek: (t) => (video.currentTime = t),
});

video.addEventListener("loadedmetadata", () => (vp.duration = video.duration));
video.addEventListener("timeupdate", () => (vp.currentTime = video.currentTime));
video.addEventListener("progress", () => {
  if (video.buffered.length) {
    vp.bufferTime = video.buffered.end(video.buffered.length - 1);
  }
});
```

### UMD / 浏览器直接引用

```html
<link rel="stylesheet" href="https://unpkg.com/videoprogress/dist/style/style.css" />
<div id="progress"></div>
<script src="https://unpkg.com/videoprogress/dist/index.umd.js"></script>
<script>
  // UMD 全局名为 Videoprogress
  new window.Videoprogress({ container: "#progress", duration: 100 });
</script>
```

## 🧩 API

### `new VideoProgress(options)`

#### Options

| 字段           | 类型                                     | 默认值              | 说明                                                |
| -------------- | ---------------------------------------- | ------------------- | --------------------------------------------------- |
| `container`    | `HTMLElement \| string`                  | —（必填）           | 挂载容器或 CSS 选择器                               |
| `currentTime`  | `number`                                 | `0`                 | 当前播放时间（秒）                                  |
| `duration`     | `number`                                 | `0`                 | 视频总时长（秒）                                    |
| `bufferTime`   | `number`                                 | `0`                 | 已缓冲时间（秒）                                    |
| `disabled`     | `boolean`                                | `false`             | 是否禁用所有交互                                    |
| `showTooltip`  | `boolean`                                | `true`              | 鼠标悬浮时是否显示时间气泡                          |
| `showTime`     | `boolean`                                | `true`              | 是否显示时间标签                                    |
| `size`         | `"sm" \| "md" \| "lg"`                   | `"md"`              | 预设尺寸                                            |
| `theme`        | `VideoProgressTheme`                     | `{}`                | 主题覆写，映射到 CSS 变量                           |
| `formatTime`   | `(time: number) => string`               | `mm:ss` / `hh:mm:ss`| 自定义时间格式化函数                                |
| `className`    | `string`                                 | `""`                | 追加到根元素的自定义 class                          |
| `ariaLabel`    | `string`                                 | `"Video progress"`  | 无障碍标签                                          |
| `onSeekStart`  | `() => void`                             | —                   | 拖拽开始回调                                        |
| `onSeek`       | `(time: number) => void`                 | —                   | 拖拽 / 键盘 seek 过程中持续回调                     |
| `onSeekEnd`    | `(time: number) => void`                 | —                   | 拖拽结束回调                                        |
| `onHover`      | `(time: number, e: MouseEvent) => void`  | —                   | 鼠标在轨道上移动回调                                |
| `onHoverEnd`   | `() => void`                             | —                   | 鼠标离开轨道回调                                    |

#### `VideoProgressTheme`

| 字段         | 类型                | CSS 变量          | 说明           |
| ------------ | ------------------- | ----------------- | -------------- |
| `primary`    | `string`            | `--vp-primary`    | 已播放部分颜色 |
| `buffer`     | `string`            | `--vp-buffer`     | 缓冲条颜色     |
| `background` | `string`            | `--vp-background` | 轨道背景色     |
| `thumb`      | `string`            | `--vp-thumb`      | 拖拽手柄颜色   |
| `height`     | `string \| number`  | `--vp-height`     | 轨道高度       |

### 实例属性 / 方法

```ts
vp.currentTime; // get / set，赋值后立即重渲染
vp.duration;    // get / set
vp.bufferTime;  // get / set
vp.disabled;    // get / set
vp.element;     // 获取根 DOM 元素

vp.update({ currentTime: 30, theme: { primary: "#f00" } }); // 批量更新
vp.destroy();   // 移除 DOM 并解绑所有事件
```

### 键盘交互

| 按键                           | 行为                                |
| ------------------------------ | ----------------------------------- |
| `ArrowRight` / `ArrowUp`       | 前进一个步长                        |
| `ArrowLeft` / `ArrowDown`      | 后退一个步长                        |
| `Home`                         | 跳到 `0`                            |
| `End`                          | 跳到 `duration`                     |

> 步长为 `max(1, round(duration / 100))` 秒。

## 🎨 主题化

所有样式都基于 CSS 自定义属性，可通过两种方式覆盖：

**方式一：通过 `theme` 选项**

```ts
new VideoProgress({
  container: "#progress",
  theme: {
    primary: "#eb2f96",
    buffer: "#ffadd2",
    thumb: "#eb2f96",
    height: 8,
  },
});
```

**方式二：直接写 CSS**

```css
.my-player .vp-container {
  --vp-primary: #ff5722;
  --vp-buffer: rgba(255, 87, 34, 0.3);
  --vp-height: 4px;
}
```

包内还内置了 `vp-dark` 暗色预设：

```ts
new VideoProgress({ container: "#progress", className: "vp-dark" });
```

## 🛠 开发

```bash
# 启动开发模式（rollup --watch）
npm run dev

# 生产构建
npm run build

# 单元测试 + 覆盖率
npm test
```

构建产物位于 `dist/`：

- `dist/index.cjs` — CommonJS
- `dist/index.mjs` — ES Module
- `dist/index.umd.js` — UMD（浏览器全局 `Videoprogress`）
- `dist/style/style.css` — 编译后的样式
- `dist/types/` — TypeScript 类型声明

## 📁 项目结构

```
src/
├─ index.ts           # 包入口，默认导出 VideoProgress
├─ main.ts            # UMD 打包入口
├─ video-progress.ts  # 组件主体
├─ interface.ts       # 公共类型定义
├─ style.ts           # 样式入口（仅副作用）
└─ style.scss         # 样式源文件
```

## 📄 License

[MIT](./LICENSE)
