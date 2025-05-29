import MyPlugin from "../main";
import { createFile } from "./utils/createFile";
import { fileExists } from "./utils/fileExists";
import { ObsidianTool, NavigationTarget, ToolExecutionResult } from "../obsidian-tools";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { requestUrl } from "obsidian";

const schema = {
  name: "download_youtube_transcript",
  description: "Downloads the transcript from a YouTube video and saves it to a specified file path in the Obsidian vault. Supports multiple languages and handles both video URLs and IDs.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The YouTube video URL or video ID (e.g., 'https://www.youtube.com/watch?v=VIDEO_ID' or just 'VIDEO_ID')",
      },
      path: {
        type: "string",
        description: "The path where the transcript file should be saved (including filename with .md extension)",
      },
      language: {
        type: "string",
        description: "Language code for the transcript (e.g., 'en' for English, 'pl' for Polish, 'fr' for French). Defaults to 'en'",
        default: "en"
      },
      includeTimestamps: {
        type: "boolean",
        description: "Whether to include timestamps in the transcript. Defaults to true",
        default: true
      },
      overwrite: {
        type: "boolean",
        description: "Whether to overwrite the file if it already exists. Defaults to false",
        default: false
      }
    },
    required: ["url", "path"]
  }
};

type DownloadYoutubeTranscriptInput = {
  url: string;
  path: string;
  language?: string;
  includeTimestamps?: boolean;
  overwrite?: boolean;
}

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

// Helper function to extract video ID from URL
function extractVideoId(url: string): string {
  // If it's already just an ID (11 characters), return it
  if (url.length === 11 && !url.includes('/')) {
    return url;
  }
  
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  throw new Error("Invalid YouTube URL or video ID format");
}

// Helper function to format transcript
function formatTranscript(transcript: TranscriptSegment[], includeTimestamps: boolean, videoId: string, language: string): string {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let content = `# YouTube Transcript\n\n`;
  content += `**Video:** ${videoUrl}\n`;
  content += `**Language:** ${language}\n`;
  content += `**Generated:** ${new Date().toISOString()}\n\n`;
  content += `---\n\n`;
  
  if (includeTimestamps) {
    content += transcript.map(item => {
      const startTime = item.offset;
      const minutes = Math.floor(startTime / 60);
      const seconds = Math.floor(startTime % 60);
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      return `**[${timestamp}]** ${item.text}`;
    }).join('\n\n');
  } else {
    content += transcript.map(item => item.text).join(' ');
  }
  
  return content;
}

// Function to fetch transcript from YouTube page
async function fetchYouTubeTranscript(videoId: string, language: string = 'en'): Promise<TranscriptSegment[]> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  try {
    const response = await requestUrl({
      url: watchUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to fetch YouTube page: HTTP ${response.status}`);
    }

    const html = response.text;
    
    // Extract ytInitialPlayerResponse from the page
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!playerResponseMatch) {
      throw new Error("Could not find player response data in YouTube page");
    }

    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    
    if (captionTracks.length === 0) {
      throw new Error("No captions available for this video");
    }

    // Find the best caption track (prefer specified language, then English, then any available)
    let selectedTrack = captionTracks.find((track: any) => track.languageCode === language);
    if (!selectedTrack) {
      selectedTrack = captionTracks.find((track: any) => track.languageCode === 'en');
    }
    if (!selectedTrack) {
      selectedTrack = captionTracks[0];
    }

    if (!selectedTrack?.baseUrl) {
      throw new Error("No valid caption track found");
    }

    // Fetch the caption data
    const captionUrl = selectedTrack.baseUrl + '&fmt=json3';
    const captionResponse = await requestUrl({
      url: captionUrl,
      method: 'GET'
    });

    if (captionResponse.status < 200 || captionResponse.status >= 300) {
      throw new Error(`Failed to fetch captions: HTTP ${captionResponse.status}`);
    }

    const captionData = JSON.parse(captionResponse.text);
    const events = captionData.events || [];

    // Process the events into transcript segments
    const segments: TranscriptSegment[] = [];
    
    for (const event of events) {
      if (event.segs) {
        const text = event.segs
          .map((seg: any) => seg.utf8 || '')
          .join('')
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
          .trim();
        
        if (text) {
          segments.push({
            text: text,
            offset: event.tStartMs ? parseFloat(event.tStartMs) / 1000 : 0,
            duration: event.dDurationMs ? parseFloat(event.dDurationMs) / 1000 : 0
          });
        }
      }
    }

    if (segments.length === 0) {
      throw new Error("No transcript content found in captions");
    }

    return segments;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch YouTube transcript: ${error.message}`);
    }
    throw new Error("Unknown error occurred while fetching transcript");
  }
}

export const downloadYoutubeTranscriptTool: ObsidianTool<DownloadYoutubeTranscriptInput> = {
  specification: schema,
  icon: "download",
  getActionText: (input: DownloadYoutubeTranscriptInput, output: string, hasResult: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') actionText = '';
    if (input.path) actionText = `transcript to "${input.path}"`;
    if (hasResult) {
      return `Downloaded ${actionText}`;
    } else {
      return `Downloading ${actionText}...`;
    }
  },
  execute: async (plugin: MyPlugin, params: DownloadYoutubeTranscriptInput): Promise<ToolExecutionResult> => {
    const { url, path, language = 'en', includeTimestamps = true, overwrite = false } = params;

    try {
      // Extract video ID from URL
      const videoId = extractVideoId(url);
      
      // Check if file already exists
      const exists = await fileExists(path, plugin.app);
      if (exists && !overwrite) {
        throw new ToolExecutionError(`File already exists at ${path}. Set overwrite to true to replace it.`);
      }

      // Fetch transcript from YouTube
      let transcript: TranscriptSegment[];
      try {
        transcript = await fetchYouTubeTranscript(videoId, language);
      } catch (error) {
        // Try with default language if the specific language fails
        if (language !== 'en') {
          try {
            transcript = await fetchYouTubeTranscript(videoId, 'en');
            console.warn(`Transcript not available in ${language}, falling back to English`);
          } catch (fallbackError) {
            throw new ToolExecutionError(`Failed to fetch transcript: ${error.message}. Video may not have transcripts available or may be private.`);
          }
        } else {
          throw new ToolExecutionError(`Failed to fetch transcript: ${error.message}. Video may not have transcripts available or may be private.`);
        }
      }

      if (!transcript || transcript.length === 0) {
        throw new ToolExecutionError("No transcript content found for this video.");
      }

      // Format the transcript content
      const formattedContent = formatTranscript(transcript, includeTimestamps, videoId, language);

      // Create the file
      await createFile(path, formattedContent, plugin.app);

      const transcriptLength = transcript.length;
      const totalDuration = transcript.length > 0 ? Math.round(transcript[transcript.length - 1].offset / 60) : 0;
      
      const resultMessage = `Successfully downloaded YouTube transcript to ${path}. Contains ${transcriptLength} segments covering approximately ${totalDuration} minutes of video content.`;

      // Create navigation target for the downloaded transcript
      const navigationTargets: NavigationTarget[] = [{
        filePath: path,
        description: "Open downloaded transcript"
      }];

      return {
        result: resultMessage,
        navigationTargets: navigationTargets
      };
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(`Failed to download YouTube transcript: ${error.message}`);
    }
  }
}; 