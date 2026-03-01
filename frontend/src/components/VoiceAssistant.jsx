import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// VAD tuning
const SPEECH_THRESHOLD = 15;  // RMS level that counts as speech
const SILENCE_AFTER_SPEECH_MS = 800; // silence gap before auto-send (snappier turn-taking)
const MIN_SPEECH_CHUNKS = 3;  // ignore blips shorter than 300ms
const POST_PLAY_PAUSE_MS = 250; // pause after TTS playback before re-listening

// ─── Icons ────────────────────────────────────────────────────────────────────

function MicIcon({ className = "w-6 h-6" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="currentColor" className={className}>
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" />
      <path d="M5 11a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0
        1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11Z" />
    </svg>
  );
}


function SpinnerIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function SpeakerIcon({ className = "w-5 h-5" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="currentColor" className={className}>
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508
        c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0
        .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5
        4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1
        1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06
        8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
      <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75
        0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

// ─── Animated waveform bars ───────────────────────────────────────────────────

function WaveBars({ color = "text-blue-500", count = 5 }) {
  const heights = [40, 70, 100, 70, 40];
  return (
    <div className={`flex items-center gap-0.5 h-5 ${color}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-current animate-pulse"
          style={{
            height: `${heights[i % heights.length]}%`,
            animationDelay: `${i * 100}ms`,
            animationDuration: "600ms",
          }}
        />
      ))}
    </div>
  );
}

// ─── Status banner (shown in conversation area when no messages yet) ──────────

function SessionBanner({ state }) {
  const configs = {
    listening: {
      bg: "bg-emerald-50 border-emerald-200",
      dot: "bg-emerald-400 animate-pulse",
      text: "text-emerald-700",
      label: "Listening…",
      sub: "Speak now — I'll detect when you're done",
    },
    speaking: {
      bg: "bg-blue-50 border-blue-200",
      dot: "bg-blue-500 animate-pulse",
      text: "text-blue-700",
      label: "Hearing you…",
      sub: "Keep going, I'll respond when you pause",
    },
    processing: {
      bg: "bg-violet-50 border-violet-200",
      dot: "bg-violet-500 animate-pulse",
      text: "text-violet-700",
      label: "Thinking…",
      sub: "Processing your message",
    },
    playing: {
      bg: "bg-amber-50 border-amber-200",
      dot: "bg-amber-400 animate-pulse",
      text: "text-amber-700",
      label: "Responding…",
      sub: "Playing audio reply",
    },
  };

  const cfg = configs[state];
  if (!cfg) return null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg}`}
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <div>
        <p className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{cfg.sub}</p>
      </div>
      {state === "speaking" && (
        <div className="ml-auto">
          <WaveBars color="text-blue-400" count={5} />
        </div>
      )}
      {state === "processing" && (
        <div className="ml-auto">
          <SpinnerIcon className="w-4 h-4 text-violet-400" />
        </div>
      )}
      {state === "playing" && (
        <div className="ml-auto">
          <SpeakerIcon className="w-4 h-4 text-amber-400" />
        </div>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ role, content, translation }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center
          text-xs flex-shrink-0 font-semibold ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-slate-100 text-slate-500 border border-slate-200"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>

      <div
        className={`flex flex-col gap-1.5 max-w-[78%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm shadow-sm"
              : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm shadow-sm"
          }`}
        >
          {content}
        </div>
        {translation && (
          <p className="text-xs text-slate-400 italic px-1 leading-relaxed">
            <span className="not-italic font-medium text-slate-300">EN · </span>
            {translation}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200
        flex items-center justify-center text-xs text-slate-500 font-semibold
        flex-shrink-0">
        AI
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm
        px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 120, 240].map((d) => (
            <div key={d} className="w-1.5 h-1.5 bg-slate-300 rounded-full
              animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// sessionState: 'idle' | 'listening' | 'speaking' | 'processing' | 'playing'

export default function VoiceAssistant() {
  const [sessionState, setSessionState] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  // Infrastructure refs — stable across renders
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const recorderRef = useRef(null);   // one recorder for the whole session
  const collectingRef = useRef(false); // true only while we want audio data
  const chunksRef = useRef([]);
  const vadIntervalRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const speechChunkCountRef = useRef(0);
  const activeRef = useRef(false);    // guards async callbacks
  const isStartingRef = useRef(false); // prevents concurrent startSession calls
  const messagesRef = useRef([]);     // mirror of messages for use in callbacks
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sessionState]);

  // Cleanup on unmount
  useEffect(() => () => teardown(), []);

  // ── Session lifecycle ────────────────────────────────────────────────────

  const startSession = async () => {
    if (isStartingRef.current || activeRef.current) return;
    isStartingRef.current = true;
    setError(null);
    try {
      // Create AudioContext synchronously within the user-gesture stack
      const AudioCtx = window.AudioContext || window["webkitAudioContext"];
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      audioCtxRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      // Route silently to destination so Chrome keeps the graph alive
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      analyser.connect(silentGain);
      silentGain.connect(ctx.destination);
      analyserRef.current = analyser;

      // One MediaRecorder that runs the WHOLE session — no stop/start per turn
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (collectingRef.current && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.start(100);
      recorderRef.current = recorder;

      activeRef.current = true;
      beginListening();
    } catch {
      teardown();
      setError(
        "Microphone access denied. Please allow mic permissions in your browser."
      );
    } finally {
      isStartingRef.current = false;
    }
  };

  const teardown = () => {
    isStartingRef.current = false;
    collectingRef.current = false;
    activeRef.current = false;
    clearInterval(vadIntervalRef.current);
    clearTimeout(silenceTimerRef.current);
    try {
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
  };

  const endSession = () => {
    teardown();
    setSessionState("idle");
  };

  // ── Listening / VAD ─────────────────────────────────────────────────────

  const beginListening = async () => {
    if (!activeRef.current) return;

    // Await resume so the analyser has real data before VAD starts polling
    if (audioCtxRef.current && audioCtxRef.current.state !== "running") {
      await audioCtxRef.current.resume();
    }
    if (!activeRef.current) return; // session may have ended while awaiting

    // Open a fresh collection window — recorder is already running
    chunksRef.current = [];
    speechChunkCountRef.current = 0;
    collectingRef.current = true;
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;

    clearInterval(vadIntervalRef.current);
    vadIntervalRef.current = setInterval(runVAD, 100);

    setSessionState("listening");
  };

  const runVAD = () => {
    if (!analyserRef.current || !activeRef.current) return;

    // If context got suspended mid-session, nudge it and wait for next poll
    if (audioCtxRef.current?.state !== "running") {
      audioCtxRef.current?.resume();
      return;
    }

    const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(buf);
    const rms = Math.sqrt(
      buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length
    );

    if (rms > SPEECH_THRESHOLD) {
      speechChunkCountRef.current += 1;
      if (speechChunkCountRef.current >= MIN_SPEECH_CHUNKS) {
        setSessionState("speaking");
      }
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    } else if (
      speechChunkCountRef.current >= MIN_SPEECH_CHUNKS &&
      !silenceTimerRef.current
    ) {
      silenceTimerRef.current = setTimeout(commitAudio, SILENCE_AFTER_SPEECH_MS);
    }
  };

  const commitAudio = () => {
    // Stop collecting — recorder keeps running, we just ignore new chunks
    collectingRef.current = false;
    clearInterval(vadIntervalRef.current);
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    setSessionState("processing");
    // Wait ~150 ms for any in-flight ondataavailable callbacks to land
    setTimeout(processRecording, 150);
  };

  // ── Audio handling ────────────────────────────────────────────────────────

  const processRecording = async () => {
    if (!activeRef.current) return;

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    // Too short — treat as noise, go back to listening
    if (blob.size < 800 || speechChunkCountRef.current < MIN_SPEECH_CHUNKS) {
      beginListening();
      return;
    }

    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append(
      "messages",
      JSON.stringify(
        messagesRef.current.map(({ role, content }) => ({ role, content }))
      )
    );

    try {
      const { data } = await axios.post(`${API_BASE_URL}/voice-chat`, formData);
      if (!activeRef.current) return;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: data.transcript, translation: null },
        {
          role: "assistant",
          content: data.reply_text,
          translation: data.translation || null,
        },
      ]);

      setSessionState("playing");
      await playAudio(data.audio_base64);

      // Brief pause so mic doesn't immediately pick up room echo from speaker
      await new Promise((r) => setTimeout(r, POST_PLAY_PAUSE_MS));

      if (activeRef.current) beginListening();
    } catch (err) {
      if (!activeRef.current) return;
      const detail =
        err.response?.data?.detail || "Something went wrong. Listening again…";
      setError(detail);
      if (activeRef.current) beginListening();
    }
  };

  const playAudio = (base64) =>
    new Promise((resolve) => {
      try {
        const bytes = atob(base64);
        const buf = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
        const blob = new Blob([buf], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        const done = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
      } catch {
        resolve();
      }
    });

  // ── Render ────────────────────────────────────────────────────────────────

  const inSession = sessionState !== "idle";

  return (
    <div
      className="w-full max-w-2xl flex flex-col"
      style={{ height: "88vh", minHeight: 520 }}
      translate="no"
    >
      <div className="flex flex-col flex-1 bg-white rounded-2xl shadow-xl
        border border-slate-100 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4
          border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center
              justify-center shadow-sm shadow-blue-200">
              <MicIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-slate-800 text-base font-semibold leading-tight">
                Voice Assistant
              </h1>
              <p className="text-slate-400 text-xs leading-tight">
                Speak in any language — I&apos;ll respond in kind
              </p>
            </div>
          </div>

          {/* Live state pill */}
          {inSession && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full
              text-xs font-medium border transition-all duration-300 ${
              sessionState === "speaking"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : sessionState === "processing"
                ? "bg-violet-50 text-violet-600 border-violet-200"
                : sessionState === "playing"
                ? "bg-amber-50 text-amber-600 border-amber-200"
                : "bg-emerald-50 text-emerald-600 border-emerald-200"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                sessionState === "speaking" ? "bg-blue-500"
                  : sessionState === "processing" ? "bg-violet-500"
                  : sessionState === "playing" ? "bg-amber-400"
                  : "bg-emerald-400"
              }`} />
              {sessionState === "listening" && "Listening"}
              {sessionState === "speaking" && "Speaking"}
              {sessionState === "processing" && "Processing"}
              {sessionState === "playing" && "Responding"}
            </div>
          )}
        </div>

        {/* ── Conversation ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4
          bg-slate-50/40">

          {/* Empty idle state */}
          {messages.length === 0 && !inSession && (
            <div className="flex flex-col items-center justify-center h-full
              gap-3 select-none">
              <div className="w-16 h-16 rounded-2xl bg-white border
                border-slate-100 shadow-sm flex items-center justify-center">
                <MicIcon className="w-7 h-7 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-sm font-medium">
                  Start a conversation
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Click the button below and speak in any language
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              translation={msg.translation}
            />
          ))}

          {/* Processing indicator */}
          {sessionState === "processing" && <TypingIndicator />}

          {/* Live session status banner */}
          {inSession && sessionState !== "processing" && (
            <SessionBanner state={sessionState} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {error && (
          <div className="mx-4 mb-3 px-4 py-2.5 bg-red-50 border
            border-red-100 rounded-xl flex-shrink-0">
            <p className="text-red-500 text-xs font-medium">⚠ {error}</p>
          </div>
        )}

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-6 py-5 bg-white
          flex-shrink-0">

          {/* ── IDLE: single start button ─────────────────────────────── */}
          {!inSession && (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={startSession}
                aria-label="Start session"
                className="w-16 h-16 rounded-full flex items-center justify-center
                  bg-blue-600 text-white hover:bg-blue-500 active:scale-95
                  shadow-md shadow-blue-100 transition-all duration-200
                  focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                <MicIcon />
              </button>
              <p className="text-slate-400 text-xs">Click to start a session</p>
            </div>
          )}

          {/* ── IN SESSION: status indicator + End Session button ────────── */}
          {inSession && (
            <div className="flex items-center justify-between gap-4">

              {/* Left: status indicator circle (non-interactive) */}
              <div className="flex flex-col items-center gap-2 w-20">
                <div className="relative">
                  {(sessionState === "listening" ||
                    sessionState === "speaking") && (
                    <span className={`absolute inset-0 rounded-full opacity-20
                      animate-ping ${
                      sessionState === "speaking"
                        ? "bg-blue-400"
                        : "bg-emerald-400"
                    }`} />
                  )}
                  <div className={`relative w-14 h-14 rounded-full flex
                    items-center justify-center shadow-sm ${
                    sessionState === "speaking"
                      ? "bg-blue-100 text-blue-500"
                      : sessionState === "processing"
                      ? "bg-violet-100 text-violet-500"
                      : sessionState === "playing"
                      ? "bg-amber-100 text-amber-500"
                      : "bg-emerald-100 text-emerald-500"
                  }`}>
                    {sessionState === "listening" && <MicIcon className="w-5 h-5" />}
                    {sessionState === "speaking" && (
                      <WaveBars color="text-blue-500" count={3} />
                    )}
                    {sessionState === "processing" && (
                      <SpinnerIcon className="w-5 h-5" />
                    )}
                    {sessionState === "playing" && (
                      <SpeakerIcon className="w-5 h-5" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 text-center leading-tight">
                  {sessionState === "listening" && "Listening"}
                  {sessionState === "speaking" && "Speaking"}
                  {sessionState === "processing" && "Thinking"}
                  {sessionState === "playing" && "Responding"}
                </p>
              </div>

              {/* Center: hint text */}
              <p className="flex-1 text-xs text-slate-400 text-center leading-relaxed">
                {sessionState === "listening" &&
                  "Speak whenever you're ready — I'll auto-detect when you're done"}
                {sessionState === "speaking" &&
                  "Hearing you — pause for a moment to send"}
                {sessionState === "processing" &&
                  "Processing your message…"}
                {sessionState === "playing" &&
                  "Playing response — listening again after"}
              </p>

              {/* Right: End Session button — always visible, always red */}
              <button
                onClick={endSession}
                aria-label="End session"
                className="flex flex-col items-center gap-1.5 group flex-shrink-0"
              >
                <div className="w-14 h-14 rounded-full flex items-center
                  justify-center bg-red-50 border-2 border-red-200 text-red-400
                  group-hover:bg-red-500 group-hover:text-white
                  group-hover:border-red-500 transition-all duration-200
                  active:scale-95 shadow-sm">
                  {/* X icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                    fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1
                      1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06
                      1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06
                      1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94
                      12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-xs text-red-400 group-hover:text-red-600
                  transition-colors font-medium">
                  End
                </p>
              </button>

            </div>
          )}
        </div>
      </div>

      <p className="text-center text-slate-300 text-xs mt-3">
        Powered by Sarvam AI · saarika:v2.5 · sarvam-m · bulbul:v2
      </p>
    </div>
  );
}
