// ElevenLabs API Service
// Provides text-to-speech and speech-to-text capabilities using ElevenLabs APIs

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  available_for_tiers?: string[];
  settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
  };
}

export interface ElevenLabsTTSOptions {
  model_id?: string; // eleven_multilingual_v2, eleven_flash_v2_5, eleven_turbo_v2_5, eleven_v3
  voice_settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  language_code?: string;
  output_format?: string; // mp3_44100_128, pcm_16000, etc.
}

export interface ElevenLabsSTTOptions {
  model_id?: string; // scribe_v1 (default)
  language?: string;
  transcription_strategy?: string;
  diarize?: boolean;
  audio_events?: boolean;
}

export interface ElevenLabsSTTResult {
  language_code: string;
  language_probability: number;
  text: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    type: 'word' | 'spacing' | 'audio_event';
    speaker_id?: string;
  }>;
}

export class ElevenLabsService {
  private readonly baseUrl = 'https://api.elevenlabs.io';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get available voices from ElevenLabs
   */
  async getVoices(): Promise<ElevenLabsVoice[]> {
    const response = await fetch(`${this.baseUrl}/v1/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices as ElevenLabsVoice[];
  }

  /**
   * Convert text to speech using ElevenLabs
   */
  async textToSpeech(
    text: string,
    voiceId: string,
    options: ElevenLabsTTSOptions = {}
  ): Promise<Blob> {
    const {
      model_id = 'eleven_multilingual_v2',
      voice_settings = {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0,
        use_speaker_boost: true,
      },
      language_code,
      output_format = 'mp3_44100_128',
    } = options;

    const body: any = {
      text,
      model_id,
      voice_settings,
    };

    if (language_code) {
      body.language_code = language_code;
    }

    const queryParams = new URLSearchParams();
    queryParams.append('output_format', output_format);
 
    const response = await fetch(
      `${this.baseUrl}/v1/text-to-speech/${voiceId}?${queryParams}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs TTS error response: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.blob();
  }

  /**
   * Convert speech to text using ElevenLabs Scribe
   */
  async speechToText(
    audioBlob: Blob,
    options: ElevenLabsSTTOptions = {}
  ): Promise<ElevenLabsSTTResult> {
    const {
      model_id = 'scribe_v1',
      language,
      transcription_strategy = 'auto',
      diarize = false,
      audio_events = false,
    } = options;

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('model_id', model_id);
    formData.append('transcription_strategy', transcription_strategy);
    formData.append('diarize', diarize.toString());
    formData.append('audio_events', audio_events.toString());

    if (language) {
      formData.append('language', language);
    }

    const response = await fetch(`${this.baseUrl}/v1/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs STT error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get a default voice ID for text-to-speech
   * This can be used when no specific voice is configured
   */
  async getDefaultVoiceId(): Promise<string> {
    try {
      const voices = await this.getVoices();
      // Try to find a good default voice
      // Prefer English voices that are available for all tiers
      const defaultVoice = voices.find(
        voice => voice.name.toLowerCase().includes('rachel') || 
                voice.name.toLowerCase().includes('adam') ||
                voice.name.toLowerCase().includes('sarah')
      ) || voices[0];
      
      return defaultVoice?.voice_id || 'pNInz6obpgDQGcFmaJgB'; // Default to Adam voice ID
    } catch (error) {
      console.warn('Failed to get voices, using default:', error);
      return 'pNInz6obpgDQGcFmaJgB'; // Default to Adam voice ID
    }
  }

  /**
   * Test API key validity
   */
  async testApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
} 