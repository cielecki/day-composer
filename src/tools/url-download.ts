import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { requestUrl } from "obsidian";

const schema = {
  name: "url_download",
  description: "Downloads content from a URL and displays it",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to download content from",
      }
    },
    required: ["url"]
  }
};

type UrlDownloadToolInput = {
  url: string;
};

// Binary content type patterns
const BINARY_CONTENT_TYPES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'application/x-binary',
  'application/x-executable',
  'application/x-msdownload',
  'application/vnd.ms-',
  'application/vnd.openxmlformats-',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'font/',
];

// Binary file extensions
const BINARY_EXTENSIONS = [
  '.exe', '.dll', '.so', '.dylib',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp',
  '.mp3', '.wav', '.flac', '.aac', '.ogg',
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  '.ttf', '.otf', '.woff', '.woff2',
];

/**
 * Checks if content type indicates binary data
 */
function isBinaryContentType(contentType: string): boolean {
  const lowerContentType = contentType.toLowerCase();
  return BINARY_CONTENT_TYPES.some(pattern => lowerContentType.includes(pattern));
}

/**
 * Checks if URL extension indicates binary data
 */
function isBinaryExtension(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return BINARY_EXTENSIONS.some(ext => lowerUrl.endsWith(ext));
}

/**
 * Checks if content contains binary data by looking for non-printable characters
 */
function containsBinaryData(content: string): boolean {
  // Check first 1024 characters for binary indicators
  const sample = content.substring(0, 1024);
  
  // Count non-printable characters (excluding common whitespace)
  let binaryChars = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // Allow printable ASCII chars (32-126) and common whitespace (9, 10, 13)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      binaryChars++;
    }
    if (code > 126 && code < 160) { // Extended ASCII control chars
      binaryChars++;
    }
  }
  
  // If more than 5% of characters are non-printable, consider it binary
  return sample.length > 0 && (binaryChars / sample.length) > 0.05;
}

export const urlDownloadTool: ObsidianTool<UrlDownloadToolInput> = {
  specification: schema,
  icon: "download",
  get initialLabel() {
    return t('tools.urlDownload.label');
  },
  execute: async (context: ToolExecutionContext<UrlDownloadToolInput>): Promise<void> => {
    const { params } = context;
    const { url } = params;

    context.setLabel(t('tools.urlDownload.inProgress', { url }));

    try {
      // Validate URL format
      let validUrl: URL;
      try {
        validUrl = new URL(url);
      } catch (error) {
        context.setLabel(t('tools.urlDownload.failed', { url }));
        throw new ToolExecutionError(`Invalid URL format: ${url}`);
      }

      // Download content from URL
      const response = await requestUrl({
        url: validUrl.toString(),
        method: 'GET',
        headers: {
          'User-Agent': 'Life Navigator Obsidian Plugin'
        }
      });

      // Check if request was successful
      if (response.status !== 200) {
        context.setLabel(t('tools.urlDownload.failed', { url }));
        throw new ToolExecutionError(`Failed to download from ${url}. Status: ${response.status}`);
      }

      // Get content type for better display
      const contentType = response.headers['content-type'] || 'text/plain';
      let content = response.text;

      // Check if content is binary
      const isBinary = isBinaryContentType(contentType) || 
                      isBinaryExtension(url) || 
                      containsBinaryData(content);

      if (isBinary) {
        const binaryInfo = [
          `**Downloaded from:** ${url}`,
          `**Content Type:** ${contentType}`,
          `**Content Length:** ${content.length} characters`,
          `**Status:** ${response.status}`,
          '',
          '⚠️ **Binary Content Detected**',
          '',
          'This URL contains binary data (such as an image, video, document, or executable file) that cannot be displayed as text.',
          '',
          'Binary content types include:',
          '- Images (JPG, PNG, GIF, etc.)',
          '- Videos and Audio files',
          '- Documents (PDF, Word, Excel, etc.)',
          '- Archives (ZIP, RAR, etc.)',
          '- Executable files',
          '',
          'To work with this content, you may need to:',
          '1. Download it directly using a browser',
          '2. Use specialized tools for the specific file type',
          '3. If it\'s a document, try converting it to text first'
        ].join('\n');

        context.setLabel(t('tools.urlDownload.completed', { url }));
        context.progress(binaryInfo);
      } else {
        // Add some basic formatting info for text content
        const downloadInfo = [
          `**Downloaded from:** ${url}`,
          `**Content Type:** ${contentType}`,
          `**Content Length:** ${content.length} characters`,
          `**Status:** ${response.status}`,
          '',
          '---',
          '',
          content
        ].join('\n');

        context.setLabel(t('tools.urlDownload.completed', { url }));
        context.progress(downloadInfo);
      }
    } catch (error) {
      context.setLabel(t('tools.urlDownload.failed', { url }));
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(`Failed to download from ${url}: ${error.message || String(error)}`);
    }
  }
}; 