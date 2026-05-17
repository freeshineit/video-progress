import React, { useState, useRef, useCallback, useEffect } from "react";
import { VideoProgress } from "@videoprogress/core";
import "@videoprogress/core/style";
import type { VideoProgressTheme } from "@videoprogress/core";

/* =========================================================================
 *  Mock player — simulates playback with timer
 * ========================================================================= */

function useMockPlayer(totalDuration: number) {
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferTime, setBufferTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate buffer growth
  useEffect(() => {
    if (bufferTime >= totalDuration) return;
    const id = setInterval(() => {
      setBufferTime((prev) => Math.min(prev + 3, totalDuration));
    }, 400);
    return () => clearInterval(id);
  }, [bufferTime, totalDuration]);

  // Playback tick
  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return Math.min(prev + 0.1, totalDuration);
      });
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalDuration]);

  const play = useCallback(() => {
    setCurrentTime((prev) => (prev >= totalDuration ? 0 : prev));
    setIsPlaying(true);
  }, [totalDuration]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const seek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  return { currentTime, bufferTime, isPlaying, play, pause, seek };
}

/* =========================================================================
 *  Themes
 * ========================================================================= */

const THEMES: Record<string, VideoProgressTheme> = {
  default: {},
  warm: {
    primary: "#fa541c",
    buffer: "#ffbb96",
    thumb: "#fa541c",
  },
  green: {
    primary: "#52c41a",
    buffer: "#b7eb8f",
    thumb: "#52c41a",
  },
  purple: {
    primary: "#722ed1",
    buffer: "#d3adf7",
    thumb: "#722ed1",
    height: 6,
  },
  thick: {
    primary: "#eb2f96",
    buffer: "#ffadd2",
    thumb: "#eb2f96",
    height: 8,
  },
};

const DURATION = 180; // 3 minutes

/* =========================================================================
 *  App
 * ========================================================================= */

const App: React.FC = () => {
  const { currentTime, bufferTime, isPlaying, play, pause, seek } =
    useMockPlayer(DURATION);

  const [log, setLog] = useState<string[]>([]);
  const [themeKey, setThemeKey] = useState("default");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [dark, setDark] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [showTime, setShowTime] = useState(true);
  const [showTooltip, setShowTooltip] = useState(true);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 25));
  }, []);

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <h1>VideoProgress</h1>
      <p className="sub">
        Video progress bar · Drag to seek · Custom themes · Callbacks
      </p>

      {/* ── Mock player ── */}
      <div className="card">
        <div className="screen">
          <span className="screen-text">
            {isPlaying ? "▶ Playing…" : "⏸ Paused"}
          </span>
        </div>

        <div className="controls-bar">
          <button className="btn-play" onClick={isPlaying ? pause : play}>
            {isPlaying ? "⏸" : "▶"}
          </button>

          {/* ★ The component */}
          <VideoProgress
            currentTime={currentTime}
            duration={DURATION}
            bufferTime={bufferTime}
            disabled={disabled}
            size={size}
            theme={THEMES[themeKey]}
            showTooltip={showTooltip}
            showTime={showTime}
            className={dark ? "vp-dark" : ""}
            onSeekStart={() => addLog("🔽 onSeekStart")}
            onSeek={(t) => {
              seek(t);
              addLog(`🎯 onSeek: ${t.toFixed(1)}s`);
            }}
            onSeekEnd={(t) => {
              seek(t);
              addLog(`✅ onSeekEnd: ${t.toFixed(1)}s`);
            }}
            onHover={(t) => {
              /* too noisy to log */
            }}
            onHoverEnd={() => {
              /* hover ended */
            }}
          />
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="panel">
        {/* Theme */}
        <div className="row">
          <label>Theme</label>
          <div className="btns">
            {Object.keys(THEMES).map((k) => (
              <button
                key={k}
                className={themeKey === k ? "on" : ""}
                onClick={() => setThemeKey(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div className="row">
          <label>Size</label>
          <div className="btns">
            {(["sm", "md", "lg"] as const).map((s) => (
              <button
                key={s}
                className={size === s ? "on" : ""}
                onClick={() => setSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="row">
          <label>Options</label>
          <div className="btns">
            <button className={dark ? "on" : ""} onClick={() => setDark(!dark)}>
              {dark ? "🌙 Dark" : "☀️ Light"}
            </button>
            <button
              className={disabled ? "on" : ""}
              onClick={() => setDisabled(!disabled)}
            >
              {disabled ? "🔒 Disabled" : "🔓 Enabled"}
            </button>
            <button
              className={!showTime ? "on" : ""}
              onClick={() => setShowTime(!showTime)}
            >
              {showTime ? "🕐 Time on" : "🕐 Time off"}
            </button>
            <button
              className={!showTooltip ? "on" : ""}
              onClick={() => setShowTooltip(!showTooltip)}
            >
              {showTooltip ? "💬 Tooltip on" : "💬 Tooltip off"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Callback log ── */}
      <div className="log">
        <h3>Callback Log</h3>
        <div className="log-list">
          {log.length === 0 && (
            <p className="log-empty">
              Click or drag the progress bar to see callbacks…
            </p>
          )}
          {log.map((m, i) => (
            <div key={i} className="log-item">
              {m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
