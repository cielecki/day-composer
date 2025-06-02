import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
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

export const urlDownloadTool: ObsidianTool<UrlDownloadToolInput> = {
  specification: schema,
  icon: "download",
  initialLabel: t('tools.urlDownload.label'),
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

      // Add some basic formatting info
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
    } catch (error) {
      context.setLabel(t('tools.urlDownload.failed', { url }));
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(`Failed to download from ${url}: ${error.message || String(error)}`);
    }
  }
}; 