// app/test-voice/page.tsx
// Simple voice test page to debug microphone permissions
/* eslint-disable no-console */
"use client";

import { useState, useEffect } from "react";

export default function TestVoicePage() {
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [permissionState, setPermissionState] = useState<string>("unknown");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  // Enumerate devices
  const checkDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      console.log("[TestVoice] Audio inputs:", inputs);
      setAudioDevices(inputs);
      return inputs.length;
    } catch (err) {
      console.error("[TestVoice] Error finding devices:", err);
      return 0;
    }
  };

  useEffect(() => {
    checkDevices();
    // Listen for device changes
    navigator.mediaDevices.ondevicechange = () => {
      console.log("[TestVoice] Device change detected");
      checkDevices();
    };
  }, []);

  // Check support
  useEffect(() => {
    const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setIsSupported(supported);
    console.log("[TestVoice] SpeechRecognition supported:", supported);

    // Check permission state
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "microphone" as any })
        .then((result) => {
          setPermissionState(result.state);
          console.log("[TestVoice] Microphone permission state:", result.state);
          result.onchange = () => {
            setPermissionState(result.state);
            console.log("[TestVoice] Permission changed to:", result.state);
          };
        })
        .catch((err) => {
          console.log("[TestVoice] Permission query error:", err);
        });
    }
  }, []);

  // Request microphone access directly first
  const requestMicAccess = async () => {
    setStatus("requesting");
    setError("");
    try {
      console.log("[TestVoice] Requesting getUserMedia...");
      // Try with more specific constraints if detection failed
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log("[TestVoice] getUserMedia success! Stream:", stream);
      setStatus("mic-granted");

      // Stop tracks immediately
      stream.getTracks().forEach((track) => track.stop());

      // Re-check permission state and devices
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: "microphone" as any });
        setPermissionState(result.state);
      }
      checkDevices();
    } catch (err) {
      console.error("[TestVoice] getUserMedia error:", err);
      setError(err instanceof Error ? err.name + ": " + err.message : String(err));
      setStatus("mic-denied");
    }
  };

  // Start speech recognition
  const startRecognition = () => {
    if (!isSupported) {
      setError("Speech recognition not supported");
      return;
    }

    setStatus("listening");
    setTranscript("");
    setError("");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("[TestVoice] Recognition started");
      setStatus("listening");
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      console.log("[TestVoice] Result:", text, "isFinal:", result.isFinal);
      setTranscript(text);
    };

    recognition.onerror = (event) => {
      console.error("[TestVoice] Error:", event.error, event.message);
      setError(`${event.error}: ${event.message || "no message"}`);
      setStatus("error");
    };

    recognition.onend = () => {
      console.log("[TestVoice] Recognition ended");
      setStatus("idle");
    };

    try {
      recognition.start();
      console.log("[TestVoice] recognition.start() called");
    } catch (err) {
      console.error("[TestVoice] start() error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-4">🎤 Voice Test Page</h1>

      <div className="space-y-4">
        {/* Status */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">Status</h2>
          <p>Speech Recognition Supported: {isSupported ? "✅ Yes" : "❌ No"}</p>
          <p>Microphone Permission: {permissionState}</p>
          <p>Current Status: {status}</p>
        </div>

        {/* Step 1: Request Mic */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">Step 1: Check Devices & Permission</h2>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-300">
              Detected Microphones ({audioDevices.length}):
            </h3>
            {audioDevices.length > 0 ? (
              <ul className="list-disc ml-5 mt-1 text-sm text-gray-400">
                {audioDevices.map((device, i) => (
                  <li key={i}>
                    {device.label || `Microphone ${i + 1} (Label hidden until permission granted)`}
                    {device.deviceId === "default" && " (Default)"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-red-400 text-sm">⚠️ No microphone detected by browser</p>
            )}
          </div>

          <button
            onClick={requestMicAccess}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Request Microphone Access
          </button>
          <p className="mt-2 text-sm text-gray-400">
            This uses navigator.mediaDevices.getUserMedia() to request mic access first.
          </p>
        </div>

        {/* Step 2: Start Recognition */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">Step 2: Start Speech Recognition</h2>
          <button
            onClick={startRecognition}
            disabled={!isSupported}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
          >
            {status === "listening" ? "🔴 Listening..." : "Start Recognition"}
          </button>
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="p-4 bg-gray-800 rounded-lg">
            <h2 className="font-semibold mb-2">Transcript</h2>
            <p className="text-xl">{transcript}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900 rounded-lg">
            <h2 className="font-semibold mb-2">Error</h2>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Console Logs */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">Debug Info</h2>
          <p className="text-sm text-gray-400">Open DevTools Console (F12) to see detailed logs.</p>
          <p className="text-sm text-gray-400 mt-2">Check console for detailed logs</p>
        </div>
      </div>
    </div>
  );
}
