import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import clsx from "clsx";
import "./index.scss";

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

export interface VideoProgressProps {
  /** Current playback time (seconds) */
  currentTime: number;
  /** Total duration (seconds) */
  duration: number;
  /** Buffered / loaded time (seconds) */
  bufferTime?: number;
  /** Custom className */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
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
  onHover?: (time: number, e: React.MouseEvent<HTMLDivElement>) => void;
  /** Fires when the mouse leaves the track */
  onHoverEnd?: () => void;

  /** Accessibility label */
  "aria-label"?: string;
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

function clientToRatio(
  clientX: number,
  el: HTMLElement,
): number {
  const r = el.getBoundingClientRect();
  return clamp((clientX - r.left) / r.width, 0, 1);
}

/* =========================================================================
 * Component
 * ========================================================================= */

const VideoProgress = React.forwardRef<HTMLDivElement, VideoProgressProps>(
  (props, ref) => {
    const {
      currentTime,
      duration,
      bufferTime = 0,
      className,
      style,
      disabled = false,
      showTooltip = true,
      showTime = true,
      size,
      theme = {},
      formatTime = defaultFormatTime,
      onSeekStart,
      onSeek,
      onSeekEnd,
      onHover,
      onHoverEnd,
      "aria-label": ariaLabel = "Video progress",
    } = props;

    /* ── Refs ── */
    const trackRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const lastSeeked = useRef(currentTime);

    /* ── State ── */
    const [hoverPct, setHoverPct] = useState<number | null>(null);
    const [hoverText, setHoverText] = useState("");
    const [hovering, setHovering] = useState(false);
    const [focused, setFocused] = useState(false);

    /* ── Derived ── */
    const safeDur = duration > 0 ? duration : 0;
    const playedPct = safeDur > 0 ? clamp(currentTime / safeDur, 0, 1) * 100 : 0;
    const bufPct = safeDur > 0 ? clamp(bufferTime / safeDur, 0, 1) * 100 : 0;

    /* ── Theme → CSS variables ── */
    const cssVars = useMemo(() => {
      const v: Record<string, string> = {};
      if (theme.primary) v["--vp-primary"] = theme.primary;
      if (theme.buffer) v["--vp-buffer"] = theme.buffer;
      if (theme.background) v["--vp-background"] = theme.background;
      if (theme.thumb) v["--vp-thumb"] = theme.thumb;
      if (theme.height !== undefined) {
        v["--vp-height"] =
          typeof theme.height === "number" ? `${theme.height}px` : theme.height;
      }
      return v;
    }, [theme]);

    /* =====================================================================
     *  Drag  (mouse + touch)
     * ===================================================================== */

    const seekAt = useCallback(
      (clientX: number) => {
        const trk = trackRef.current;
        if (!trk || safeDur <= 0) return;
        const t = clientToRatio(clientX, trk) * safeDur;
        lastSeeked.current = t;
        onSeek?.(t);
      },
      [safeDur, onSeek],
    );

    const beginDrag = useCallback(
      (clientX: number) => {
        if (disabled) return;
        dragging.current = true;
        onSeekStart?.();
        seekAt(clientX);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      },
      [disabled, onSeekStart, seekAt],
    );

    const endDrag = useCallback(() => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      onSeekEnd?.(lastSeeked.current);
    }, [onSeekEnd]);

    // Global move / up listeners
    useEffect(() => {
      const onMove = (e: MouseEvent) => {
        if (!dragging.current) return;
        seekAt(e.clientX);
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!dragging.current) return;
        seekAt(e.touches[0]?.clientX ?? 0);
      };
      const onUp = () => endDrag();
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onTouchMove, { passive: true });
      document.addEventListener("touchend", onUp);
      return () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onUp);
      };
    }, [seekAt, endDrag]);

    /* =====================================================================
     *  Mouse / Touch on track
     * ===================================================================== */

    const onTrackMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (disabled || e.button !== 0) return;
        e.preventDefault();
        beginDrag(e.clientX);
      },
      [disabled, beginDrag],
    );

    const onTrackTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (disabled) return;
        beginDrag(e.touches[0]?.clientX ?? 0);
      },
      [disabled, beginDrag],
    );

    const onThumbMouseDown = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        beginDrag(e.clientX);
      },
      [beginDrag],
    );

    /* =====================================================================
     *  Hover
     * ===================================================================== */

    const onMouseEnter = useCallback(() => {
      if (disabled) return;
      setHovering(true);
    }, [disabled]);

    const onMouseLeave = useCallback(() => {
      setHovering(false);
      setHoverPct(null);
      onHoverEnd?.();
    }, [onHoverEnd]);

    const onMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) return;
        const trk = trackRef.current;
        if (!trk) return;
        const ratio = clientToRatio(e.clientX, trk);
        setHoverPct(ratio * 100);
        const t = ratio * safeDur;
        setHoverText(formatTime(t));
        onHover?.(t, e);
      },
      [disabled, safeDur, formatTime, onHover],
    );

    /* =====================================================================
     *  Keyboard
     * ===================================================================== */

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;
        const step = safeDur > 0 ? Math.max(1, Math.round(safeDur / 100)) : 1;
        let t = currentTime;

        switch (e.key) {
          case "ArrowRight":
          case "ArrowUp":
            e.preventDefault();
            t = Math.min(currentTime + step, safeDur);
            break;
          case "ArrowLeft":
          case "ArrowDown":
            e.preventDefault();
            t = Math.max(currentTime - step, 0);
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
        lastSeeked.current = t;
        onSeek?.(t);
        onSeekEnd?.(t);
      },
      [disabled, currentTime, safeDur, onSeek, onSeekEnd],
    );

    /* =====================================================================
     *  Focus
     * ===================================================================== */
    const onFocus = useCallback(() => setFocused(true), []);
    const onBlur = useCallback(() => setFocused(false), []);

    /* =====================================================================
     *  Render
     * ===================================================================== */
    const cls = clsx(
      "vp-container",
      {
        "vp-disabled": disabled,
        "vp-focused": focused,
        "vp-hovering": hovering,
        "vp-sm": size === "sm",
        "vp-lg": size === "lg",
      },
      className,
    );

    return (
      <div
        className={cls}
        style={{ ...cssVars, ...style }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        ref={ref}
      >
        {/* ── Track ── */}
        <div
          className="vp-track"
          ref={trackRef}
          onMouseDown={onTrackMouseDown}
          onTouchStart={onTrackTouchStart}
          role="slider"
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={safeDur}
          aria-valuenow={currentTime}
          aria-valuetext={formatTime(currentTime)}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {/* Rail */}
          <div className="vp-rail" />

          {/* Buffer */}
          {bufPct > 0 && <div className="vp-buffer" style={{ width: `${bufPct}%` }} />}

          {/* Played */}
          <div className="vp-played" style={{ width: `${playedPct}%` }} />

          {/* Thumb */}
          <div
            className="vp-thumb"
            style={{ left: `${playedPct}%` }}
            onMouseDown={onThumbMouseDown}
          />

          {/* Hover line */}
          {hovering && hoverPct != null && (
            <div className="vp-hover-line" style={{ left: `${hoverPct}%` }} />
          )}

          {/* Tooltip */}
          {showTooltip && hovering && hoverPct != null && (
            <div className="vp-tooltip" style={{ left: `${hoverPct}%` }}>
              <span className="vp-tooltip-text">{hoverText}</span>
            </div>
          )}
        </div>

        {/* ── Time labels ── */}
        {showTime && (
          <div className="vp-time">
            <span className="vp-time-current">{formatTime(currentTime)}</span>
            <span className="vp-time-sep">/</span>
            <span className="vp-time-duration">{formatTime(safeDur)}</span>
          </div>
        )}
      </div>
    );
  },
);

VideoProgress.displayName = "VideoProgress";
export default VideoProgress;
