import React, { useState, useRef, useEffect, KeyboardEvent, useCallback, useMemo } from "react";
import { usePluginStore } from "../store/plugin-store";
import { t } from 'src/i18n';
import { LucideIcon } from '../components/LucideIcon';
import { ModeDropdown } from '../components/ModeDropdown';
import { AttachedImage } from 'src/types/attached-image';
import { TFile } from "obsidian";
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';

// Define the number of samples to keep for the waveform (5 seconds at 10 samples per second)
const WAVEFORM_HISTORY_LENGTH = 120; // 4 seconds at 30 samples per second

// Generate a unique window ID for this component instance
const generateWindowId = () => `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const UnifiedInputArea: React.FC<{
  editingMessage?: { index: number; content: string; images?: AttachedImage[] } | null;
  chatId?: string;
  onSendMessage?: (message: string, images?: AttachedImage[]) => Promise<void>;
}> = ({ editingMessage, chatId, onSendMessage }) => {
  // Generate a stable window ID for this component instance
  const windowId = useMemo(() => generateWindowId(), []);

  const getChatState = usePluginStore(state => state.getChatState);
  const getTranscriptionState = usePluginStore(state => state.getTranscriptionState);
  const chatState = chatId ? getChatState(chatId) : null;
  const transcriptionState = chatId ? getTranscriptionState(chatId) : null;
  const isGeneratingResponse = chatState?.isGenerating || false;

  // Audio state from global store
  const isGeneratingSpeech = usePluginStore(state => state.audio.isGeneratingSpeech);
  const isSpeaking = usePluginStore(state => state.audio.isSpeaking);
  const isSpeakingPaused = usePluginStore(state => state.audio.isSpeakingPaused);
  
  // Recording/transcription state - now window/chat specific
  const isRecordingInWindow = usePluginStore(state => state.isRecordingInWindow);
  const canRecordInWindow = usePluginStore(state => state.canRecordInWindow);
  const isRecording = isRecordingInWindow(windowId);
  const canRecord = canRecordInWindow(windowId);
  const isTranscribing = transcriptionState?.isTranscribing || false;
  const lastTranscription = transcriptionState?.lastTranscription || null;

  const prevIsTranscribingRef = useRef(isTranscribing);
  const processedTranscriptionRef = useRef<string | null>(null);

  const addUserMessage = usePluginStore(state => state.addUserMessage);
  const editUserMessage = usePluginStore(state => state.editUserMessage);
  const cancelEditingMessage = usePluginStore(state => state.cancelEditingMessage);
  const recordingStart = usePluginStore(state => state.recordingStart);
  const recordingStop = usePluginStore(state => state.recordingStop);
  const recordingToTranscribing = usePluginStore(state => state.recordingToTranscribing);
  const audioStop = usePluginStore(state => state.audioStop);
  const chatStop = usePluginStore(state => state.chatStop);
  const setLastTranscription = usePluginStore(state => state.setLastTranscription);

  const currentChatId = chatId || 'default';

  const updateInputState = usePluginStore(state => state.updateInputState);
  const getInputState = usePluginStore(state => state.getInputState);
  const clearInputState = usePluginStore(state => state.clearInputState);

  const inputState = chatId ? getInputState(chatId) : { text: '', attachedImages: [] };
  const message = inputState.text;
  const attachedImages = inputState.attachedImages;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setMessage = (text: string) => {
    if (chatId) {
      updateInputState(chatId, { text });
    }
  };

  const setAttachedImages = (images: AttachedImage[]) => {
    if (chatId) {
      updateInputState(chatId, { attachedImages: images });
    }
  };

  const [waveformData, setWaveformData] = useState<number[]>(
    Array(WAVEFORM_HISTORY_LENGTH).fill(0),
  );
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const waveformIntervalRef = useRef<number | null>(null);

  const [volumeLevel, setVolumeLevel] = useState(0);

  // Mode dropdown state - now handled by ModeDropdown component

  // Mode-related store access
  const availableModes = usePluginStore(state => state.modes.available);
  const isModesLoading = usePluginStore(state => state.modes.isLoading);
  const setActiveModeForChat = usePluginStore(state => state.setActiveModeForChat);

  // Get active mode for this chat
  const chatActiveModeId = chatState?.chat.storedConversation.modeId || DEFAULT_MODE_ID;
  const activeMode = availableModes[chatActiveModeId];
  const isModeLoading = Boolean(chatActiveModeId && !availableModes[chatActiveModeId]);

  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
      setAttachedImages(editingMessage.images || []);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
      }, 100);
    } else {
      setMessage("");
      setAttachedImages([]);
    }
  }, [editingMessage]);

  useEffect(() => {
    if (
      isTranscribing === false &&
      lastTranscription &&
      lastTranscription !== processedTranscriptionRef.current
    ) {
      // Mark this transcription as processed to prevent infinite loops
      processedTranscriptionRef.current = lastTranscription;
      
      const newMessage = message.trim()
        ? `${message} ${lastTranscription}`
        : lastTranscription;
            
      const imagesToSend = [...attachedImages];
      setAttachedImages([]);
      
      setMessage(newMessage);
      
      // Clear the transcription to prevent re-processing
      if (chatId) {
        setLastTranscription(chatId, null);
      }
      
      setTimeout(() => {
        const messageToSend = newMessage;

        if (usePluginStore.getState().getChatState(currentChatId)?.isGenerating) {
          return;
        }
        
        if (messageToSend.trim() === "" && imagesToSend.length === 0) {
          return;
        }

        if (editingMessage) {
          console.debug("Auto-saving edit after transcription");
          editUserMessage(currentChatId, editingMessage.index, messageToSend, imagesToSend);
        } else {
          console.debug("Auto-sending new message after transcription");
          if (imagesToSend.length > 0) {
            addUserMessage(currentChatId, messageToSend, imagesToSend);
          } else {
            addUserMessage(currentChatId, messageToSend);
          }
        }

        setMessage("");
      }, 10);
    }
  }, [isTranscribing, lastTranscription, isGeneratingResponse, isRecording, isSpeaking, isGeneratingSpeech, addUserMessage, editUserMessage, attachedImages, editingMessage, currentChatId, chatId, setLastTranscription]);

  useEffect(() => {
    if (textareaRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        const textarea = textareaRef.current;
        if (textarea && message) {
              textarea.classList.add("ln-textarea-auto");
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
        }
      });

      resizeObserver.observe(textareaRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [message]);

  useEffect(() => {
    if (isRecording) {
      setWaveformData(Array(WAVEFORM_HISTORY_LENGTH).fill(0));
      
      setupAudioAnalyzer();
      waveformIntervalRef.current = window.setInterval(() => {
        updateWaveformData();
      }, 33);
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isRecording]);

  const cleanup = () => {
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

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
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        console.debug("Closing existing AudioContext");
        audioContextRef.current.close();
      }

      if (streamRef.current) {
        console.debug("Stopping existing stream tracks");
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      audioContextRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;

      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;

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

    let volume =
      dataArray.reduce((acc, val) => Math.max(acc, val), 0) / 255;

    const threshold = 0.3;
    volume -= threshold;
    volume = Math.max(0, volume / (1 - threshold));
    volume *= 100;

    const normalizedLevel = Math.min(100, Math.max(0, volume));

    setWaveformData((prevData) => [...prevData.slice(1), normalizedLevel]);
  };

  const handleStartRecording = async () => {
    try {
      if (chatId && isGeneratingResponse) {
        chatStop(chatId);
      } else if (usePluginStore.getState().getChatState(currentChatId)?.isGenerating) {
        chatStop(currentChatId);
      }
      
      const success = await recordingStart(windowId);
      if (!success) {
        console.debug('Recording blocked - another window is already recording');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() && attachedImages.length === 0) return;

    try {
      const messageToSend = message.trim();
      const imagesToSend = [...attachedImages];

      if (editingMessage) {
        if (chatId) {
          await editUserMessage(chatId, editingMessage.index, messageToSend, imagesToSend);
        }
      } else {
        if (onSendMessage) {
          await onSendMessage(messageToSend, imagesToSend);
        } else if (chatId) {
          await addUserMessage(chatId, messageToSend, imagesToSend);
        }
      }

      setMessage("");
      setAttachedImages([]);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleCancelEdit = () => {
    if (chatId) {
      cancelEditingMessage(chatId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (isGeneratingResponse || isGeneratingSpeech) {
        if (chatId) {
          chatStop(chatId);
        }
        audioStop();
        
        setTimeout(() => {
          handleSubmit();
        }, 100);
      } else {
        handleSubmit();
      }
    }
  };

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setMessage(e.target.value);

    const textarea = e.target;
    textarea.classList.add("ln-textarea-auto");
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  const generateId = () => {
    return Math.random().toString(36).substring(2, 11);
  };

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
                name: file.name || t("ui.attachments.pastedImage"),
                src: base64Data,
              };
              const newImages = [...attachedImages, newImage];
              setAttachedImages(newImages);
            }
          };

          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

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
            const newImages = [...attachedImages, newImage];
            setAttachedImages(newImages);
          }
        };

        reader.readAsDataURL(file);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (imageId: string) => {
    const newImages = attachedImages.filter((img) => img.id !== imageId);
    setAttachedImages(newImages);
  };

  const handleMicrophoneClick = () => {
    if (isSpeaking || isGeneratingSpeech) {
      console.debug("Stopping audio playback before starting recording");
      audioStop();
    }
    
    handleStartRecording();
  };

  const handleStopAll = () => {
    audioStop();
    if (chatId) {
      chatStop(chatId);
    }
  };

  const handleFinalizeRecording = async () => {
    if (chatId) {
      await recordingToTranscribing(windowId, chatId);
    }
  };

  useEffect(() => {
    if (!isRecording) return;
    const timer = setTimeout(() => {
      if (volumeLevel === 0) {
        setVolumeLevel(2);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [volumeLevel, isRecording]);

  useEffect(() => {
    if (!isTranscribing) {
      setWaveformData(Array(WAVEFORM_HISTORY_LENGTH).fill(0));
    }
  }, [isTranscribing]);

  const handleSendButtonClick = async () => {
    if (isRecording) {
      try {
        await audioStop();
      } catch (error) {
        console.error('Failed to stop recording:', error);
      }
    } else if (editingMessage) {
      const messageToSend = message.trim();
      if (messageToSend || attachedImages.length > 0) {
        if (chatId) {
          await editUserMessage(chatId, editingMessage.index, messageToSend, attachedImages);
        }
        setMessage("");
        setAttachedImages([]);
      }
    } else {
      const finalMessage = message.trim();
      
      if (finalMessage || attachedImages.length > 0) {
        if (onSendMessage) {
          await onSendMessage(finalMessage, attachedImages);
        } else if (chatId) {
          await addUserMessage(chatId, finalMessage, attachedImages);
        }
        setMessage("");
        setAttachedImages([]);
      }
    }
  };

  const handleStopGeneration = () => {
    if (chatId) {
      chatStop(chatId);
    }
  };

  const handleStopClick = () => {
    if (chatId) {
      chatStop(chatId);
    }
  };

  // Mode selection handler
  const handleModeSwitch = useCallback(async (modeId: string) => {
    if (chatId) {
      setActiveModeForChat(chatId, modeId);
    } else {
      console.warn('UnifiedInputArea: No chatId provided for mode switch');
    }
  }, [setActiveModeForChat, chatId]);

  return (
    <div className="unified-input-container">
      <input
        type="file"
        ref={fileInputRef}
        className="ln-hidden"
        accept="image/*"
        onChange={handleFileChange}
        multiple
        disabled={isRecording || isTranscribing}
      />

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

        <div className="input-wrapper">
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

          {(isRecording || isTranscribing) && (
            <div className="waveform-container">
              <div className="waveform">
                {waveformData.map((level, index) => (
                  <div
                    key={index}
                    className="waveform-bar ln-waveform-bar-dynamic"
                    style={{
                      height: `${level}%`,
                      opacity: Math.max(
                        0.3,
                        index / WAVEFORM_HISTORY_LENGTH,
                      ),
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="input-controls-bottom">
          <div className="input-controls-left">
            {/* Mode dropdown - using unified component */}
            <ModeDropdown
              chatId={chatId}
              chatActiveModeId={chatActiveModeId}
              activeMode={activeMode}
              isModeLoading={isModeLoading}
              isModesLoading={isModesLoading}
              availableModes={availableModes}
              onModeSelect={handleModeSwitch}
            />
            
            {isRecording && !isTranscribing && (
              <button
                className="input-control-button"
                onClick={() => recordingStop(windowId)}
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

          <div className="input-controls-right">
            <>
              {/* Image attachment button - moved to right side */}
              {!isRecording && (
                <button
                  className="input-control-button"
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

              {!isRecording && !isTranscribing && (
                <button
                  className="input-control-button primary"
                  onClick={handleMicrophoneClick}
                  disabled={!canRecord}
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
                  className="input-control-button"
                  onClick={audioStop}
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
              
              {isRecording && !isTranscribing && (
                <>
                  <button
                    className="input-control-button primary"
                    onClick={handleFinalizeRecording}
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

              {(isGeneratingResponse || isSpeaking || isGeneratingSpeech || isSpeakingPaused) && !isRecording && (
                <button
                  className="input-control-button primary"
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

              {!isTranscribing && !isRecording && !(isGeneratingResponse || isSpeaking || isGeneratingSpeech || isSpeakingPaused) && (
                <button
                  className="input-control-button primary"
                  onClick={handleSendButtonClick}
                  aria-label={editingMessage ? t("ui.input.save") : t("ui.input.send")}
                  disabled={(message.trim() === "" && attachedImages.length === 0) || !activeMode}
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
