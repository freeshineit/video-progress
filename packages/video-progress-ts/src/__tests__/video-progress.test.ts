/**
 * @jest-environment jsdom
 */
import {
  VideoProgress,
  defaultFormatTime,
  VideoProgressOptions,
} from "../video-progress";

/* =========================================================================
 * Test helpers
 * ========================================================================= */

const TRACK_WIDTH = 200;
const TRACK_LEFT = 0;

/**
 * Mock getBoundingClientRect on any element.
 * jsdom returns all zeros by default, so we patch the track element.
 */
function mockTrackRect(track: HTMLElement, width = TRACK_WIDTH, left = TRACK_LEFT) {
  track.getBoundingClientRect = jest.fn(
    () =>
      ({
        x: left,
        y: 0,
        left,
        top: 0,
        right: left + width,
        bottom: 0,
        width,
        height: 6,
        toJSON: () => ({}),
      }) as DOMRect,
  );
}

function makeContainer(): HTMLElement {
  const c = document.createElement("div");
  document.body.appendChild(c);
  return c;
}

/** Build instance + mock the track rect for predictable seek math. */
function build(opts: Partial<VideoProgressOptions> = {}) {
  const container = makeContainer();
  const vp = new VideoProgress({ container, duration: 100, ...opts });
  const track = vp.element.querySelector(".vp-track") as HTMLElement;
  mockTrackRect(track);
  return { vp, container, track };
}

afterEach(() => {
  document.body.innerHTML = "";
  jest.restoreAllMocks();
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
});

/* =========================================================================
 * defaultFormatTime
 * ========================================================================= */

describe("defaultFormatTime", () => {
  it("formats sub-hour times as mm:ss", () => {
    expect(defaultFormatTime(0)).toBe("00:00");
    expect(defaultFormatTime(5)).toBe("00:05");
    expect(defaultFormatTime(65)).toBe("01:05");
    expect(defaultFormatTime(599)).toBe("09:59");
  });

  it("formats hour-plus times as hh:mm:ss", () => {
    expect(defaultFormatTime(3600)).toBe("01:00:00");
    expect(defaultFormatTime(3661)).toBe("01:01:01");
    expect(defaultFormatTime(3600 * 10 + 5)).toBe("10:00:05");
  });

  it("guards against invalid input", () => {
    expect(defaultFormatTime(-1)).toBe("00:00");
    expect(defaultFormatTime(NaN)).toBe("00:00");
    expect(defaultFormatTime(Infinity)).toBe("00:00");
  });
});

/* =========================================================================
 * Construction & DOM
 * ========================================================================= */

describe("VideoProgress — construction", () => {
  it("mounts into an HTMLElement container", () => {
    const { vp, container } = build();
    expect(container.contains(vp.element)).toBe(true);
    expect(vp.element.classList.contains("vp-container")).toBe(true);
    expect(vp.element.querySelector(".vp-track")).toBeTruthy();
    expect(vp.element.querySelector(".vp-rail")).toBeTruthy();
    expect(vp.element.querySelector(".vp-buffer")).toBeTruthy();
    expect(vp.element.querySelector(".vp-played")).toBeTruthy();
    expect(vp.element.querySelector(".vp-thumb")).toBeTruthy();
    expect(vp.element.querySelector(".vp-tooltip")).toBeTruthy();
    expect(vp.element.querySelector(".vp-time")).toBeTruthy();
  });

  it("mounts into a CSS-selector container", () => {
    const c = makeContainer();
    c.id = "host";
    const vp = new VideoProgress({ container: "#host" });
    expect(c.contains(vp.element)).toBe(true);
  });

  it("throws when selector container is not found", () => {
    expect(() => new VideoProgress({ container: "#missing" })).toThrow(
      /container "#missing" not found/,
    );
  });

  it("uses defaults when options are omitted", () => {
    const c = makeContainer();
    const vp = new VideoProgress({ container: c });
    const track = vp.element.querySelector(".vp-track") as HTMLElement;
    expect(track.getAttribute("aria-label")).toBe("Video progress");
    expect(track.getAttribute("aria-valuemax")).toBe("0");
    expect(track.getAttribute("aria-valuenow")).toBe("0");
    expect(track.getAttribute("aria-disabled")).toBe("false");
    expect(track.tabIndex).toBe(0);
  });
});

/* =========================================================================
 * Rendering
 * ========================================================================= */

describe("VideoProgress — render", () => {
  it("renders played and buffer percentages", () => {
    const { vp } = build({ duration: 100, currentTime: 25, bufferTime: 50 });
    const played = vp.element.querySelector(".vp-played") as HTMLElement;
    const buffer = vp.element.querySelector(".vp-buffer") as HTMLElement;
    const thumb = vp.element.querySelector(".vp-thumb") as HTMLElement;
    expect(played.style.width).toBe("25%");
    expect(buffer.style.width).toBe("50%");
    expect(thumb.style.left).toBe("25%");
  });

  it("clamps overflowing currentTime/bufferTime to 100%", () => {
    const { vp } = build({ duration: 100, currentTime: 500, bufferTime: 500 });
    const played = vp.element.querySelector(".vp-played") as HTMLElement;
    const buffer = vp.element.querySelector(".vp-buffer") as HTMLElement;
    expect(played.style.width).toBe("100%");
    expect(buffer.style.width).toBe("100%");
  });

  it("yields 0% when duration is 0 or negative", () => {
    const { vp } = build({ duration: 0, currentTime: 50 });
    const played = vp.element.querySelector(".vp-played") as HTMLElement;
    expect(played.style.width).toBe("0%");

    vp.duration = -10;
    expect(played.style.width).toBe("0%");
  });

  it("applies size variants", () => {
    const sm = build({ size: "sm" });
    expect(sm.vp.element.classList.contains("vp-sm")).toBe(true);

    const lg = build({ size: "lg" });
    expect(lg.vp.element.classList.contains("vp-lg")).toBe(true);

    const md = build({ size: "md" });
    expect(md.vp.element.classList.contains("vp-sm")).toBe(false);
    expect(md.vp.element.classList.contains("vp-lg")).toBe(false);
  });

  it("appends a custom className", () => {
    const { vp } = build({ className: "custom" });
    expect(vp.element.classList.contains("custom")).toBe(true);
    expect(vp.element.classList.contains("vp-container")).toBe(true);
  });

  it("toggles disabled class and tabIndex/aria-disabled", () => {
    const { vp } = build({ disabled: true });
    const track = vp.element.querySelector(".vp-track") as HTMLElement;
    expect(vp.element.classList.contains("vp-disabled")).toBe(true);
    expect(track.tabIndex).toBe(-1);
    expect(track.getAttribute("aria-disabled")).toBe("true");

    vp.disabled = false;
    expect(vp.element.classList.contains("vp-disabled")).toBe(false);
    expect(track.tabIndex).toBe(0);
    expect(track.getAttribute("aria-disabled")).toBe("false");
  });

  it("hides time labels when showTime=false", () => {
    const { vp } = build({ showTime: false });
    const time = vp.element.querySelector(".vp-time") as HTMLElement;
    expect(time.style.display).toBe("none");
  });

  it("shows time labels with formatted current/duration", () => {
    const { vp } = build({ duration: 90, currentTime: 30 });
    const cur = vp.element.querySelector(".vp-time-current") as HTMLElement;
    const dur = vp.element.querySelector(".vp-time-duration") as HTMLElement;
    expect(cur.textContent).toBe("00:30");
    expect(dur.textContent).toBe("01:30");
  });

  it("uses a custom formatTime function", () => {
    const fmt = jest.fn((t: number) => `T=${Math.floor(t)}`);
    const { vp } = build({ duration: 60, currentTime: 12, formatTime: fmt });
    const cur = vp.element.querySelector(".vp-time-current") as HTMLElement;
    expect(cur.textContent).toBe("T=12");
    expect(fmt).toHaveBeenCalled();
  });

  it("applies theme CSS variables, including numeric and string height", () => {
    const { vp } = build({
      theme: {
        primary: "#f00",
        buffer: "#00f",
        background: "#eee",
        thumb: "#0f0",
        height: 8,
      },
    });
    expect(vp.element.style.getPropertyValue("--vp-primary")).toBe("#f00");
    expect(vp.element.style.getPropertyValue("--vp-buffer")).toBe("#00f");
    expect(vp.element.style.getPropertyValue("--vp-background")).toBe("#eee");
    expect(vp.element.style.getPropertyValue("--vp-thumb")).toBe("#0f0");
    expect(vp.element.style.getPropertyValue("--vp-height")).toBe("8px");

    vp.update({ theme: { height: "12px" } });
    expect(vp.element.style.getPropertyValue("--vp-height")).toBe("12px");
  });

  it("sets aria-label and aria-valuetext from formatter", () => {
    const { vp } = build({ ariaLabel: "Seek bar", duration: 120, currentTime: 60 });
    const track = vp.element.querySelector(".vp-track") as HTMLElement;
    expect(track.getAttribute("aria-label")).toBe("Seek bar");
    expect(track.getAttribute("aria-valuemax")).toBe("120");
    expect(track.getAttribute("aria-valuenow")).toBe("60");
    expect(track.getAttribute("aria-valuetext")).toBe("01:00");
  });
});

/* =========================================================================
 * Setters / update / destroy
 * ========================================================================= */

describe("VideoProgress — setters & update()", () => {
  it("getters reflect current state", () => {
    const { vp } = build({ duration: 50, currentTime: 10, bufferTime: 20 });
    expect(vp.currentTime).toBe(10);
    expect(vp.duration).toBe(50);
    expect(vp.bufferTime).toBe(20);
    expect(vp.disabled).toBe(false);
  });

  it("setters update state and re-render", () => {
    const { vp } = build({ duration: 100 });
    vp.currentTime = 40;
    vp.duration = 200;
    vp.bufferTime = 80;
    expect(vp.currentTime).toBe(40);
    expect(vp.duration).toBe(200);
    expect(vp.bufferTime).toBe(80);
    const played = vp.element.querySelector(".vp-played") as HTMLElement;
    expect(played.style.width).toBe("20%");
  });

  it("update() merges all option fields", () => {
    const { vp } = build({ duration: 100 });
    const onSeek = jest.fn();
    const onSeekStart = jest.fn();
    const onSeekEnd = jest.fn();
    const onHover = jest.fn();
    const onHoverEnd = jest.fn();
    const fmt = jest.fn((t: number) => `${t}s`);
    vp.update({
      currentTime: 1,
      duration: 200,
      bufferTime: 5,
      disabled: true,
      showTooltip: false,
      showTime: false,
      size: "lg",
      theme: { primary: "#abc" },
      formatTime: fmt,
      className: "x",
      ariaLabel: "AL",
      onSeek,
      onSeekStart,
      onSeekEnd,
      onHover,
      onHoverEnd,
    });
    expect(vp.currentTime).toBe(1);
    expect(vp.duration).toBe(200);
    expect(vp.bufferTime).toBe(5);
    expect(vp.disabled).toBe(true);
    expect(vp.element.classList.contains("vp-lg")).toBe(true);
    expect(vp.element.classList.contains("x")).toBe(true);
    const time = vp.element.querySelector(".vp-time") as HTMLElement;
    expect(time.style.display).toBe("none");
  });

  it("destroy() removes the element and is idempotent", () => {
    const { vp, container } = build();
    vp.destroy();
    expect(container.contains(vp.element)).toBe(false);
    // Calling again should not throw
    expect(() => vp.destroy()).not.toThrow();
  });

  it("destroy() prevents subsequent renders", () => {
    const { vp } = build();
    vp.destroy();
    // After destroy, mutating values must not throw
    expect(() => {
      vp.currentTime = 99;
    }).not.toThrow();
  });
});

/* =========================================================================
 * Drag interactions (mouse)
 * ========================================================================= */

describe("VideoProgress — mouse drag", () => {
  it("seeks on track mousedown and fires onSeekStart + onSeek", () => {
    const onSeekStart = jest.fn();
    const onSeek = jest.fn();
    const { track } = build({ duration: 100, onSeekStart, onSeek });
    track.dispatchEvent(
      new MouseEvent("mousedown", { clientX: 100, button: 0, bubbles: true }),
    );
    expect(onSeekStart).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(50);
    expect(document.body.style.userSelect).toBe("none");
    expect(document.body.style.cursor).toBe("grabbing");
  });

  it("ignores mousedown when disabled", () => {
    const onSeek = jest.fn();
    const { track } = build({ disabled: true, onSeek });
    track.dispatchEvent(
      new MouseEvent("mousedown", { clientX: 100, button: 0, bubbles: true }),
    );
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("ignores non-left mouse button (button !== 0)", () => {
    const onSeek = jest.fn();
    const { track } = build({ onSeek });
    track.dispatchEvent(
      new MouseEvent("mousedown", { clientX: 100, button: 2, bubbles: true }),
    );
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("does not seek when duration is 0", () => {
    const onSeek = jest.fn();
    const { track } = build({ duration: 0, onSeek });
    track.dispatchEvent(
      new MouseEvent("mousedown", { clientX: 100, button: 0, bubbles: true }),
    );
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("continues seeking on document mousemove and ends on mouseup", () => {
    const onSeek = jest.fn();
    const onSeekEnd = jest.fn();
    const { track } = build({ duration: 100, onSeek, onSeekEnd });
    track.dispatchEvent(
      new MouseEvent("mousedown", { clientX: 50, button: 0, bubbles: true }),
    );
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 150 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    expect(onSeek).toHaveBeenLastCalledWith(75);
    expect(onSeekEnd).toHaveBeenCalledWith(75);
    expect(document.body.style.userSelect).toBe("");
    expect(document.body.style.cursor).toBe("");
  });

  it("does not respond to document mousemove when not dragging", () => {
    const onSeek = jest.fn();
    build({ duration: 100, onSeek });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 50 }));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("mouseup without an active drag is a no-op", () => {
    const onSeekEnd = jest.fn();
    build({ duration: 100, onSeekEnd });
    document.dispatchEvent(new MouseEvent("mouseup"));
    expect(onSeekEnd).not.toHaveBeenCalled();
  });

  it("clamps seek position to [0, duration]", () => {
    const onSeek = jest.fn();
    const { track } = build({ duration: 100, onSeek });
    track.dispatchEvent(
      new MouseEvent("mousedown", { clientX: -50, button: 0, bubbles: true }),
    );
    expect(onSeek).toHaveBeenLastCalledWith(0);
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 9999 }));
    expect(onSeek).toHaveBeenLastCalledWith(100);
    document.dispatchEvent(new MouseEvent("mouseup"));
  });

  it("thumb mousedown begins a drag and stops propagation", () => {
    const onSeekStart = jest.fn();
    const { vp } = build({ duration: 100, onSeekStart });
    const thumb = vp.element.querySelector(".vp-thumb") as HTMLElement;
    const ev = new MouseEvent("mousedown", { clientX: 100, button: 0, bubbles: true });
    const stop = jest.spyOn(ev, "stopPropagation");
    const prev = jest.spyOn(ev, "preventDefault");
    thumb.dispatchEvent(ev);
    expect(onSeekStart).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalled();
    expect(prev).toHaveBeenCalled();
    document.dispatchEvent(new MouseEvent("mouseup"));
  });
});

/* =========================================================================
 * Touch interactions
 * ========================================================================= */

describe("VideoProgress — touch", () => {
  function touchEvent(type: string, clientX: number | undefined): TouchEvent {
    const ev = new Event(type, { bubbles: true }) as TouchEvent;
    Object.defineProperty(ev, "touches", {
      value: clientX === undefined ? [] : [{ clientX } as Touch],
    });
    return ev;
  }

  it("begins drag on touchstart and seeks on touchmove", () => {
    const onSeekStart = jest.fn();
    const onSeek = jest.fn();
    const onSeekEnd = jest.fn();
    const { track } = build({ duration: 100, onSeekStart, onSeek, onSeekEnd });
    track.dispatchEvent(touchEvent("touchstart", 50));
    expect(onSeekStart).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenLastCalledWith(25);

    document.dispatchEvent(touchEvent("touchmove", 150));
    expect(onSeek).toHaveBeenLastCalledWith(75);

    document.dispatchEvent(touchEvent("touchend", 150));
    expect(onSeekEnd).toHaveBeenCalledWith(75);
  });

  it("ignores touchstart when disabled", () => {
    const onSeek = jest.fn();
    const { track } = build({ disabled: true, onSeek });
    track.dispatchEvent(touchEvent("touchstart", 50));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("falls back to clientX=0 when touches array is empty", () => {
    const onSeek = jest.fn();
    const { track } = build({ duration: 100, onSeek });
    track.dispatchEvent(touchEvent("touchstart", undefined));
    // ratio = 0 → time = 0
    expect(onSeek).toHaveBeenLastCalledWith(0);
    document.dispatchEvent(touchEvent("touchmove", undefined));
    document.dispatchEvent(touchEvent("touchend", undefined));
  });

  it("touchmove without an active drag is a no-op", () => {
    const onSeek = jest.fn();
    build({ duration: 100, onSeek });
    document.dispatchEvent(touchEvent("touchmove", 100));
    expect(onSeek).not.toHaveBeenCalled();
  });
});

/* =========================================================================
 * Hover
 * ========================================================================= */

describe("VideoProgress — hover", () => {
  it("shows hover line + tooltip on mousemove and updates text", () => {
    const onHover = jest.fn();
    const { vp, track } = build({ duration: 100, onHover });
    vp.element.dispatchEvent(new MouseEvent("mouseenter"));
    // Simulate mousemove on the container; hover line uses track rect math
    void track;
    vp.element.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));

    const hoverLine = vp.element.querySelector(".vp-hover-line") as HTMLElement;
    const tooltip = vp.element.querySelector(".vp-tooltip") as HTMLElement;
    const tooltipText = vp.element.querySelector(".vp-tooltip-text") as HTMLElement;
    expect(hoverLine.style.display).toBe("");
    expect(hoverLine.style.left).toBe("50%");
    expect(tooltip.style.display).toBe("");
    expect(tooltip.style.left).toBe("50%");
    expect(tooltipText.textContent).toBe("00:50");
    expect(onHover).toHaveBeenCalled();
    expect(onHover.mock.calls[0][0]).toBe(50);
  });

  it("hides tooltip when showTooltip=false", () => {
    const { vp } = build({ duration: 100, showTooltip: false });
    vp.element.dispatchEvent(new MouseEvent("mouseenter"));
    vp.element.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
    const tooltip = vp.element.querySelector(".vp-tooltip") as HTMLElement;
    expect(tooltip.style.display).toBe("none");
  });

  it("ignores hover events when disabled", () => {
    const onHover = jest.fn();
    const { vp } = build({ disabled: true, onHover });
    vp.element.dispatchEvent(new MouseEvent("mouseenter"));
    vp.element.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
    expect(vp.element.classList.contains("vp-hovering")).toBe(false);
    expect(onHover).not.toHaveBeenCalled();
  });

  it("hides hover line/tooltip and fires onHoverEnd on mouseleave", () => {
    const onHoverEnd = jest.fn();
    const { vp } = build({ duration: 100, onHoverEnd });
    vp.element.dispatchEvent(new MouseEvent("mouseenter"));
    vp.element.dispatchEvent(new MouseEvent("mousemove", { clientX: 80 }));
    vp.element.dispatchEvent(new MouseEvent("mouseleave"));

    const hoverLine = vp.element.querySelector(".vp-hover-line") as HTMLElement;
    const tooltip = vp.element.querySelector(".vp-tooltip") as HTMLElement;
    expect(hoverLine.style.display).toBe("none");
    expect(tooltip.style.display).toBe("none");
    expect(onHoverEnd).toHaveBeenCalled();
    expect(vp.element.classList.contains("vp-hovering")).toBe(false);
  });
});

/* =========================================================================
 * Keyboard
 * ========================================================================= */

describe("VideoProgress — keyboard", () => {
  function keydown(track: HTMLElement, key: string) {
    const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    track.dispatchEvent(ev);
    return ev;
  }

  it("ArrowRight / ArrowUp step forward by max(1, dur/100)", () => {
    const onSeek = jest.fn();
    const onSeekEnd = jest.fn();
    const { vp, track } = build({ duration: 200, currentTime: 50, onSeek, onSeekEnd });
    keydown(track, "ArrowRight");
    expect(onSeek).toHaveBeenLastCalledWith(52);
    expect(onSeekEnd).toHaveBeenLastCalledWith(52);
    keydown(track, "ArrowUp");
    expect(onSeek).toHaveBeenLastCalledWith(52);
    void vp;
  });

  it("ArrowLeft / ArrowDown step backward and clamp at 0", () => {
    const onSeek = jest.fn();
    const { track } = build({ duration: 200, currentTime: 1, onSeek });
    keydown(track, "ArrowLeft");
    expect(onSeek).toHaveBeenLastCalledWith(0);
    keydown(track, "ArrowDown");
    expect(onSeek).toHaveBeenLastCalledWith(0);
  });

  it("ArrowRight clamps at duration", () => {
    const onSeek = jest.fn();
    const { track } = build({ duration: 100, currentTime: 99, onSeek });
    keydown(track, "ArrowRight");
    expect(onSeek).toHaveBeenLastCalledWith(100);
  });

  it("Home jumps to 0 and End jumps to duration", () => {
    const onSeek = jest.fn();
    const onSeekEnd = jest.fn();
    const { track } = build({ duration: 100, currentTime: 30, onSeek, onSeekEnd });
    keydown(track, "Home");
    expect(onSeek).toHaveBeenLastCalledWith(0);
    expect(onSeekEnd).toHaveBeenLastCalledWith(0);
    keydown(track, "End");
    expect(onSeek).toHaveBeenLastCalledWith(100);
    expect(onSeekEnd).toHaveBeenLastCalledWith(100);
  });

  it("ignores other keys", () => {
    const onSeek = jest.fn();
    const { track } = build({ duration: 100, onSeek });
    keydown(track, "Tab");
    keydown(track, "a");
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("ignores keyboard when disabled", () => {
    const onSeek = jest.fn();
    const { track } = build({ disabled: true, duration: 100, onSeek });
    keydown(track, "ArrowRight");
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("uses step=1 when duration is 0", () => {
    const onSeek = jest.fn();
    const { track } = build({ duration: 0, currentTime: 0, onSeek });
    keydown(track, "ArrowRight");
    // safeDur = 0, so Math.min(0+1, 0) = 0
    expect(onSeek).toHaveBeenLastCalledWith(0);
  });
});

/* =========================================================================
 * Focus / blur
 * ========================================================================= */

describe("VideoProgress — focus", () => {
  it("toggles vp-focused class on focus / blur", () => {
    const { vp, track } = build();
    track.dispatchEvent(new FocusEvent("focus"));
    expect(vp.element.classList.contains("vp-focused")).toBe(true);
    track.dispatchEvent(new FocusEvent("blur"));
    expect(vp.element.classList.contains("vp-focused")).toBe(false);
  });
});
