import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-8 h-8"
    >
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" />
      <path d="M5 11a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-8 h-8"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="w-8 h-8 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-700 rounded-2xl rounded-tl-sm px-5 py-4">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-gray-700 text-gray-100 rounded-tl-sm"
        }`}
      >
        <p className="text-xs opacity-60 mb-1">
          {isUser ? "🎤 आप" : "🤖 असिस्टेंट"}
        </p>
        {content}
      </div>
    </div>
  );
}

export default function VoiceAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        handleAudioReady();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setError(
        "माइक्रोफ़ोन तक पहुँच नहीं मिली। ब्राउज़र में अनुमति दें।"
      );
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleAudioReady = async () => {
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];

    if (blob.size < 500) {
      setError("रिकॉर्डिंग बहुत छोटी है। दोबारा कोशिश करें।");
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append(
      "messages",
      JSON.stringify(messages.map(({ role, content }) => ({ role, content })))
    );

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/voice-chat`,
        formData
      );

      setMessages((prev) => [
        ...prev,
        { role: "user", content: data.transcript },
        { role: "assistant", content: data.reply_text },
      ]);

      playAudio(data.audio_base64);
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        "कुछ गड़बड़ी हुई। दोबारा कोशिश करें।";
      setError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (base64String) => {
    try {
      const bytes = atob(base64String);
      const buffer = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        buffer[i] = bytes.charCodeAt(i);
      }
      const blob = new Blob([buffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
    } catch {
      console.error("Audio playback failed");
    }
  };

  const handleMicClick = () => {
    if (isLoading) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const micLabel = isLoading
    ? "प्रोसेस हो रहा है..."
    : isRecording
    ? "रोकने के लिए दबाएँ"
    : "बोलने के लिए दबाएँ";

  return (
    <div
      className="w-full max-w-2xl bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      style={{ height: "85vh", minHeight: "500px" }}
    >
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center gap-3 flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
        <div>
          <h1 className="text-white text-lg font-semibold tracking-tight">
            हिंदी वॉयस असिस्टेंट
          </h1>
          <p className="text-gray-500 text-xs">
            Powered by Sarvam AI · Saarika · Sarvam-M · Bulbul
          </p>
        </div>
      </div>

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center select-none">
            <div className="text-5xl mb-4 opacity-30">🎙️</div>
            <p className="text-gray-500 text-sm">
              हिंदी में बोलें और बातचीत शुरू करें
            </p>
            <p className="text-gray-600 text-xs mt-1">
              नीचे माइक बटन दबाएँ
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}

        {isLoading && <TypingDots />}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-3 bg-red-950/60 border border-red-800/60 rounded-xl flex-shrink-0">
          <p className="text-red-400 text-sm">⚠ {error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="border-t border-gray-700/60 px-6 py-5 flex flex-col items-center gap-3 flex-shrink-0">
        <button
          onClick={handleMicClick}
          disabled={isLoading}
          aria-label={micLabel}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg focus:outline-none focus-visible:ring-4 ${
            isLoading
              ? "bg-gray-700 cursor-not-allowed text-gray-500"
              : isRecording
              ? "bg-red-600 text-white ring-4 ring-red-500/40 animate-pulse hover:bg-red-500"
              : "bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 focus-visible:ring-blue-500/50 active:scale-95"
          }`}
        >
          {isLoading ? <Spinner /> : isRecording ? <StopIcon /> : <MicIcon />}
        </button>

        <p className="text-gray-500 text-sm text-center h-5">{micLabel}</p>
      </div>
    </div>
  );
}
