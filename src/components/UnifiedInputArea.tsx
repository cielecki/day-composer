import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useAIAgent } from "../context/AIAgentContext";
import { useSpeechToText } from "../context/SpeechToTextContext";
import { useTextToSpeech } from "../context/TextToSpeechContext";
import { t } from '../i18n';
import { LucideIcon } from './LucideIcon';

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
  editingMessage?: { index: number; content: string; images?: any[] } | null;
}> = ({ newAbortController, abort, editingMessage }) => {
  const { addUserMessage, isGeneratingResponse, editUserMessage, cancelEditingMessage } = useAIAgent();
  const {
    isRecording,
    isTranscribing,
    lastTranscription,
    startRecording,
    finalizeRecording,
    cancelTranscription,
  } = useSpeechToText();
  const { isPlayingAudio, isGeneratingSpeech, stopAudio, isPaused } = useTextToSpeech();

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

  // Initialize editing state when editingMessage changes
  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
      setAttachedImages(editingMessage.images || []);
      // Focus the textarea after a brief delay to ensure proper rendering
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
      }, 100);
    } else {
      // Reset state when exiting editing mode
      setMessage("");
      setAttachedImages([]);
    }
  }, [editingMessage]);

  // Effect to handle transcription completion and insert text into input
  useEffect(() => {
    // Detect when transcription completes (transition from true to false)
    if (
      prevIsTranscribingRef.current &&
      !isTranscribing &&
      lastTranscription
    ) {
      // Add the transcription to the message (append to existing text)
      const newMessage = message.trim()
        ? `${message} ${lastTranscription}`
        : lastTranscription;
      
      // Always auto-send after transcription completes, whether editing or new message
      if (isPlayingAudio || isGeneratingSpeech) {
        console.log("Transcription completed during audio playback - stopping audio and auto-sending");
        stopAudio();
      }
      
      // Immediately clear images to prevent flash before auto-send
      const imagesToSend = [...attachedImages];
      setAttachedImages([]);
      
      // Set the message and then send it in the next tick
      setMessage(newMessage);
      setTimeout(() => {
        // Send/save the message with proper handling of both text and images
        const messageToSend = newMessage;
        
        if (messageToSend.trim() === "" && imagesToSend.length === 0) {
          return;
        }

        // Process any attached images for the final message
        let finalImageData: any[] = [];
        if (imagesToSend.length > 0) {
          finalImageData = imagesToSend.map((img) => ({
            type: "image",
            source: {
              type: "base64",
              media_type: img.src.split(";")[0].split(":")[1], // Extract MIME type
              data: img.src.split(",")[1], // Extract base64 data without the prefix
            },
          }));
        }

        // Handle editing vs new message
        if (editingMessage) {
          // For editing mode, save the edit
          console.log("Auto-saving edit after transcription");
          const controller = newAbortController();
          editUserMessage(editingMessage.index, messageToSend, controller.signal, finalImageData);
        } else {
          // For new message mode, send as new message
          console.log("Auto-sending new message after transcription");
          if (finalImageData.length > 0) {
            addUserMessage(messageToSend, newAbortController().signal, finalImageData);
          } else {
            addUserMessage(messageToSend, newAbortController().signal);
          }
        }

        // Reset state
        setMessage("");
      }, 10);
    }
    // Update ref with current value for next comparison
    prevIsTranscribingRef.current = isTranscribing;
  }, [isTranscribing, lastTranscription, isGeneratingResponse, isRecording, isPlayingAudio, isGeneratingSpeech, message, addUserMessage, editUserMessage, newAbortController, attachedImages, stopAudio, editingMessage]);

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
      // Immediately reset waveform data to prevent showing old/noise data
      setWaveformData(Array(WAVEFORM_HISTORY_LENGTH).fill(0));
      
      setupAudioAnalyzer();
      // Start collecting waveform data at higher frequency (30 samples per second)
      waveformIntervalRef.current = window.setInterval(() => {
        updateWaveformData();
      }, 33); // ~30fps
    } else {
      // Clean up when recording stops
      cleanup();
      // Also clear the waveform data to ensure clean state
      setWaveformData(Array(WAVEFORM_HISTORY_LENGTH).fill(0));
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
      // Clean up any existing contexts or streams first
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        console.log("Closing existing AudioContext");
        audioContextRef.current.close();
      }

      if (streamRef.current) {
        console.log("Stopping existing stream tracks");
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Reset refs
      audioContextRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;

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

    // If in editing mode, save the edit instead of sending new message
    if (editingMessage) {
      const finalMessage = message;

      if (attachedImages.length > 0) {
        // Create image data for editing
        const imageData = attachedImages.map((img) => ({
          type: "image",
          source: {
            type: "base64",
            media_type: img.src.split(";")[0].split(":")[1], // Extract MIME type
            data: img.src.split(",")[1], // Extract base64 data without the prefix
          },
        }));

        // For editing, pass both text and images
        const controller = newAbortController();
        editUserMessage(editingMessage.index, finalMessage, controller.signal, imageData);
      } else {
        // Just save text message
        const controller = newAbortController();
        editUserMessage(editingMessage.index, finalMessage, controller.signal);
      }

      // Reset state after editing
      setMessage("");
      setAttachedImages([]);
      return;
    }

    // Regular message sending logic
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

  // Handle cancel editing
  const handleCancelEdit = () => {
    setMessage("");
    setAttachedImages([]);
    cancelEditingMessage();
  };

  // Handle Enter key to send message (Shift+Enter for new line)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // If a response is being generated, abort it first before sending new message
      if (isGeneratingResponse || isPlayingAudio || isGeneratingSpeech) {
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
    if (isTranscribing) {
      // If transcribing, cancel the transcription
      handleCancelRecording();
    } else if (isRecording) {
      finalizeRecording();
    } else {
      // Stop any playing audio when starting to record
      if (isPlayingAudio || isGeneratingSpeech) {
        console.log("Stopping audio playback before starting recording");
        stopAudio();
      }
      
      const controller = newAbortController();
      abortControllerRef.current = controller;
      startRecording(controller.signal);
    }
  };

  // Handle cancel recording or transcription
  const handleCancelRecording = () => {
    if (isTranscribing) {
      // Cancel transcription first
      cancelTranscription();
    }
    
    // Cancel recording if active
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Don't call the main abort() here as it handles different operations
    // The recording/transcription cancellation should be handled separately
    // from generation/audio playback cancellation
  };

  // Unified stop handler for all operations
  const handleStopAll = () => {
    // Stop recording/transcription first
    if (isRecording || isTranscribing) {
      handleCancelRecording();
    }
    
    // Then stop generation/audio playback
    abort();
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
        disabled={isRecording || isTranscribing}
      />

      {/* Editing header - shown when editing a message */}
      {editingMessage && (
        <div className="editing-header">
          <div className="editing-label">
            <LucideIcon name="edit" size={16} />
            <span>{t('ui.message.editing')}</span>
          </div>
          <button
            className="clickable-icon editing-close-button"
            onClick={handleCancelEdit}
            aria-label={t('buttons.cancel')}
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>
      )}

      <div className="unified-input-area">
        {/* Image preview area - hidden during transcription */}
        {attachedImages.length > 0 && !isTranscribing && (
          <div className="attached-images-preview">
            {attachedImages.map((image) => (
              <div className="attached-image-circular" key={image.id}>
                <div className="attached-image-thumbnail-circular">
                  <img
                    src={image.src}
                    alt={image.name}
                    className="thumbnail-circular"
                  />
                </div>
                <button
                  className="attached-image-remove-circular"
                  onClick={() => handleRemoveImage(image.id)}
                  aria-label={t("ui.input.removeFile").replace(
                    "{{filename}}",
                    image.name,
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
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

        {/* Full-width input area with text input or waveform */}
        <div className="input-wrapper">
          {/* Text area - always present but can be visually hidden during recording */}
          <textarea
            ref={textareaRef}
            className={`unified-input-textarea ${isRecording || isTranscribing ? "recording" : ""}`}
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
            {/* Image attach button - hidden during recording */}
            {!isRecording && (
              <button
                className="input-control-button image-button"
                aria-label={t("ui.input.attachImage")}
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                disabled={isTranscribing}
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
            )}
            
            {/* Cancel recording button - visible only during recording (not transcription) */}
            {isRecording && !isTranscribing && (
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
            )}
          </div>

          {/* Right-aligned controls */}
          <div className="input-controls-right">
            {/* Regular mode controls - show even when editing to allow voice recording and normal send */}
            <>
              {/* Microphone button to START recording - visible when not currently recording */}
              {!isRecording && !isTranscribing && (
                <button
                  className="input-control-button mic-button"
                  onClick={handleMicrophoneClick}
                  disabled={false}
                  aria-label={t("ui.recording.start")}
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
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line
                      x1="12"
                      y1="19"
                      x2="12"
                      y2="22"
                    ></line>
                  </svg>
                </button>
              )}

              {isTranscribing && (
                <button
                  className="input-control-button mic-button confirm transcribing"
                  onClick={handleCancelRecording}
                  disabled={false}
                  aria-label={t("ui.recording.cancel")}
                >
                  <LucideIcon
                    name="loader"
                    className="spinner"
                    size={20}
                    />
                </button>
              )}
              
              {/* Button visible DURING recording - Finish Recording button */}
              {isRecording && !isTranscribing && (
                <>
                  <button // This is the "Finish Recording" button
                    className="input-control-button mic-button confirm"
                    onClick={finalizeRecording}
                    disabled={false}
                    aria-label={t("ui.recording.confirm")}
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
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </button>
                </>
              )}

              {/* Stop button - visible for generation, audio playback, and transcription (but NOT basic recording) */}
              {(isGeneratingResponse || isPlayingAudio || isGeneratingSpeech || isPaused) && !isRecording && (
                <button
                  className="input-control-button stop-button"
                  onClick={handleStopAll}
                  aria-label={t("ui.recording.stop")}
                >
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
                </button>
              )}

              {/* Send button - visible when not recording, AND nothing is being generated */}
              {!isTranscribing && !isRecording && !(isGeneratingResponse || isPlayingAudio || isGeneratingSpeech || isPaused) && (
                <button
                  className="input-control-button send-button"
                  onClick={handleSendMessage}
                  aria-label={editingMessage ? t("ui.input.save") : t("ui.input.send")}
                  disabled={message.trim() === "" && attachedImages.length === 0}
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
                    <path d="M22 2L11 13"></path>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
                  </svg>
                </button>
              )}
            </>
          </div>
        </div>
      </div>
    </div>
  );
};
