import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useAIAgent } from "src/context/AIAgentContext";
import { useSpeechToText } from "../context/SpeechToTextContext";
import { useTextToSpeech } from "src/context/TextToSpeechContext";
import { t } from "../i18n";
import { LucideIcon } from "./LucideIcon";

// Define an interface for attached images (keeping compatibility with TextInputArea)
interface AttachedImage {
  id: string;
  name: string;
  src: string;
}

// Define the number of samples to keep for the waveform (5 seconds at 10 samples per second)
const WAVEFORM_HISTORY_LENGTH = 120; // 4 seconds at 30 samples per second

export const UnifiedInputArea: React.FC<{
  newAbortController: () => AbortController;
  abort: () => void;
}> = ({ newAbortController, abort }) => {
  const { addUserMessage, isGeneratingResponse } = useAIAgent();
  const {
    isRecording,
    isTranscribing,
    lastTranscription,
    startRecording,
    finalizeRecording,
  } = useSpeechToText();
  const { isPlayingAudio } = useTextToSpeech();

  // Input state
  const [message, setMessage] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio visualization state
  const [waveformData, setWaveformData] = useState<number[]>(
    Array(WAVEFORM_HISTORY_LENGTH).fill(0),
  );
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const waveformIntervalRef = useRef<number | null>(null);

  // Previous state tracking for transcription handling
  const prevIsTranscribingRef = useRef(isTranscribing);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Volume level state
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Effect to handle transcription completion and insert text into input
  useEffect(() => {
    // Detect when transcription completes (transition from true to false)
    if (
      prevIsTranscribingRef.current &&
      !isTranscribing &&
      lastTranscription
    ) {
      // Insert the transcription into the text input rather than sending it directly
      setMessage((prev) => {
        const newMessage = prev.trim()
          ? `${prev} ${lastTranscription}`
          : lastTranscription;
        // Resize the textarea without focusing it
        if (textareaRef.current) {
          // Delay a bit to ensure DOM updates have completed
          setTimeout(() => {
            const textarea = textareaRef.current;
            if (textarea) {
              //textarea.focus();
              textarea.style.height = "auto";
              textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;

              // Trigger a fake input event to ensure any native resizing behaviors are triggered
              //const inputEvent = new Event('input', { bubbles: true });
              //textarea.dispatchEvent(inputEvent);

              // Second resize attempt with longer delay to ensure rendering is complete
              setTimeout(() => {
                if (textarea) {
                  textarea.style.height = "auto";
                  textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
                }
              }, 100);
            }
          }, 10);
        }
        return newMessage;
      });
    }
    // Update ref with current value for next comparison
    prevIsTranscribingRef.current = isTranscribing;
  }, [isTranscribing, lastTranscription]);

  // Add ResizeObserver to ensure textarea is properly sized
  useEffect(() => {
    if (textareaRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        const textarea = textareaRef.current;
        if (textarea && message) {
          textarea.style.height = "auto";
          textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
        }
      });

      resizeObserver.observe(textareaRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [message]);

  // Setup audio analyzer when recording starts
  useEffect(() => {
    if (isRecording) {
      setupAudioAnalyzer();
      // Start collecting waveform data at higher frequency (30 samples per second)
      waveformIntervalRef.current = window.setInterval(() => {
        updateWaveformData();
      }, 33); // ~30fps
    } else {
      // Clean up when recording stops
      cleanup();
    }

    return () => cleanup();
  }, [isRecording]);

  const cleanup = () => {
    // Clear waveform interval
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    // Clean up audio context and analyzer
    if (analyserRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }

      analyserRef.current = null;
      audioContextRef.current = null;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const setupAudioAnalyzer = async () => {
    try {
      // If we already have an active analyzer, don't create a new one
      if (
        audioContextRef.current &&
        analyserRef.current &&
        streamRef.current
      ) {
        console.log("Audio analyzer already set up");
        return;
      }

      // Clean up any existing contexts or streams
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Create audio context
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Create analyzer node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;

      // Connect microphone to analyzer
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Reset waveform data
      setWaveformData(Array(WAVEFORM_HISTORY_LENGTH).fill(0));
    } catch (error) {
      console.error("Error setting up audio analyzer:", error);
    }
  };

  const updateWaveformData = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.smoothingTimeConstant = 0;
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate volume level (average of frequency data)
    let volume =
      dataArray.reduce((acc, val) => Math.max(acc, val), 0) / 255;

    // Apply threshold and normalize
    const threshold = 0.3;
    volume -= threshold;
    volume = Math.max(0, volume / (1 - threshold));
    volume *= 100;

    // Normalize to 0-100 range
    const normalizedLevel = Math.min(100, Math.max(0, volume));

    // Update waveform data (shift left and add new value)
    setWaveformData((prevData) => [...prevData.slice(1), normalizedLevel]);
  };

  // Handle message submission
  const handleSendMessage = () => {
    if (message.trim() === "" && attachedImages.length === 0) return;

    // Process any attached images
    const finalMessage = message;

    if (attachedImages.length > 0) {
      // Create a new message with text and attached images
      const imageData = attachedImages.map((img) => ({
        type: "image",
        source: {
          type: "base64",
          media_type: img.src.split(";")[0].split(":")[1], // Extract MIME type
          data: img.src.split(",")[1], // Extract base64 data without the prefix
        },
      }));

      // Add the images to the message
      addUserMessage(
        finalMessage,
        newAbortController().signal,
        imageData,
      );
    } else {
      // Just send text message
      addUserMessage(finalMessage, newAbortController().signal);
    }

    setMessage("");
    setAttachedImages([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Handle Enter key to send message (Shift+Enter for new line)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // If a response is being generated, abort it first before sending new message
      if (isGeneratingResponse || isPlayingAudio) {
        abort();
        // Use setTimeout to ensure abort is processed before sending the new message
        setTimeout(() => {
          handleSendMessage();
        }, 100);
      } else {
        handleSendMessage();
      }
    }
  };

  // Auto-resize textarea based on content
  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setMessage(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  // Generate a unique ID for each image (kept for compatibility)
  const generateId = () => {
    return Math.random().toString(36).substring(2, 11);
  };

  // Handle paste events to capture images (kept for compatibility)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();

          reader.onload = (event) => {
            if (event.target && event.target.result) {
              const base64Data = event.target.result.toString();
              const newImage: AttachedImage = {
                id: generateId(),
                name:
                  file.name ||
                  t("ui.attachments.pastedImage"),
                src: base64Data,
              };
              setAttachedImages((prev) => [...prev, newImage]);
            }
          };

          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  // Handle file selection from the file input (kept for compatibility)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.type.indexOf("image") !== -1) {
        const reader = new FileReader();

        reader.onload = (event) => {
          if (event.target && event.target.result) {
            const base64Data = event.target.result.toString();
            const newImage: AttachedImage = {
              id: generateId(),
              name: file.name,
              src: base64Data,
            };
            setAttachedImages((prev) => [...prev, newImage]);
          }
        };

        reader.readAsDataURL(file);
      }
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle removing an image (kept for compatibility)
  const handleRemoveImage = (imageId: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  // Handle microphone button click
  const handleMicrophoneClick = () => {
    if (isRecording) {
      finalizeRecording();
    } else {
      const controller = newAbortController();
      abortControllerRef.current = controller;
      startRecording(controller.signal);
    }
  };

  // Handle cancel recording
  const handleCancelRecording = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abort();
  };

  // Handle send/stop button click
  const handleSendStopClick = () => {
    if (isGeneratingResponse || isPlayingAudio) {
      abort();
    } else {
      handleSendMessage();
    }
  };

  // Reset the volume after a short duration of silence
  useEffect(() => {
    if (!isRecording) return;
    const timer = setTimeout(() => {
      if (volumeLevel === 0) {
        // Reset to a tiny baseline level for visual aesthetics
        setVolumeLevel(2);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [volumeLevel, isRecording]);

  return (
    <div className="unified-input-container">
      {/* Hidden file input for image selection */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
        multiple
      />

      {/* Image preview area */}
      {attachedImages.length > 0 && (
        <div className="attached-images-preview">
          {attachedImages.map((image) => (
            <div className="attached-image" key={image.id}>
              <div className="attached-image-thumbnail">
                <img
                  src={image.src}
                  alt={image.name}
                  className="thumbnail"
                  style={{
                    maxWidth: "100px",
                    maxHeight: "100px",
                    objectFit: "contain",
                  }}
                />
              </div>
              <div className="attached-image-name">
                {image.name}
              </div>
              <button
                className="attached-image-remove"
                onClick={() => handleRemoveImage(image.id)}
                aria-label={t("ui.input.removeFile").replace(
                  "{{filename}}",
                  image.name,
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="unified-input-area">
        {/* Full-width input area with text input or waveform */}
        <div className="input-wrapper">
          {/* Text area - always present but can be visually hidden during recording */}
          <textarea
            ref={textareaRef}
            className={`unified-input-textarea ${isRecording ? "recording" : ""}`}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t("ui.input.placeholder")}
            rows={1}
            disabled={isRecording || isTranscribing}
          />

          {/* Waveform visualization */}
          {isRecording && (
            <div className="waveform-container">
              <div className="waveform">
                {waveformData.map((level, index) => (
                  <div
                    key={index}
                    className="waveform-bar"
                    style={{
                      height: `${level}%`,
                      opacity: Math.max(
                        0.3,
                        index / WAVEFORM_HISTORY_LENGTH,
                      ), // Fade out older samples
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Button controls below input, aligned left and right */}
        <div className="input-controls-bottom">
          {/* Left-aligned controls */}
          <div className="input-controls-left">
            {/* Image attach button */}
            <button
              className="input-control-button image-button"
              aria-label={t("ui.input.attachImage")}
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              disabled={isRecording || isTranscribing}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  ry="2"
                ></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>
          </div>

          {/* Right-aligned controls */}
          <div className="input-controls-right">
            {/* Microphone button to START recording - visible only when message is empty and not currently recording */}
            {message.trim() === "" && attachedImages.length === 0 && !isRecording && (
              <button
                className={`input-control-button mic-button ${isTranscribing ? "transcribing" : ""}`}
                onClick={handleMicrophoneClick}
                disabled={isTranscribing || isPlayingAudio}
                aria-label={
                  isTranscribing
                    ? t("ui.recording.transcribing")
                    : t("ui.recording.start")
                }
              >
                {isTranscribing ? (
                  <LucideIcon
                    name="loader"
                    className="spinner"
                    size={20}
                  />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line
                      x1="12"
                      y1="19"
                      x2="12"
                      y2="22"
                    ></line>
                  </svg>
                )}
              </button>
            )}

            {/* Buttons visible DURING recording */}
            {isRecording && (
              <>
                <button
                  className="input-control-button cancel-button"
                  onClick={handleCancelRecording}
                  aria-label={t("ui.recording.cancel")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                <button // This is the "Finish Recording" button
                  className={`input-control-button mic-button recording ${isTranscribing ? "transcribing" : ""}`}
                  onClick={handleMicrophoneClick} // Calls finalizeRecording when isRecording is true
                  disabled={isTranscribing || isPlayingAudio}
                  aria-label={
                    isTranscribing
                      ? t("ui.recording.transcribing")
                      : t("ui.recording.stop") // Label for "Finish Recording"
                  }
                >
                  {isTranscribing ? (
                    <LucideIcon
                      name="loader"
                      className="spinner"
                      size={20}
                    />
                  ) : ( // Stop icon for "Finish Recording"
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="none"
                    >
                      <rect x="6" y="6" width="12" height="12" />
                    </svg>
                  )}
                </button>
              </>
            )}

            {/* Send button - visible when there's a message or image, AND not recording */}
            {(message.trim() !== "" || attachedImages.length > 0) && !isRecording && (
              <button
                className={`input-control-button send-button ${isGeneratingResponse || isPlayingAudio ? "working" : ""}`}
                onClick={handleSendStopClick}
                disabled={
                  message.trim() === "" &&
                  attachedImages.length === 0 &&
                  !(isGeneratingResponse || isPlayingAudio)
                }
                aria-label={
                  isGeneratingResponse || isPlayingAudio
                    ? t("ui.recording.stop")
                    : t("ui.input.send")
                }
              >
                {isGeneratingResponse || isPlayingAudio ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                  >
                    <rect x="6" y="6" width="12" height="12" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 2L11 13"></path>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
