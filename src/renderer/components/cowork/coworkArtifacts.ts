import {
  normalizeFilePathForDedup,
  parseCodeBlockArtifacts,
  parseFileLinksFromMessage,
  parseFilePathsFromText,
  parseToolArtifact,
  stripFileLinksFromText,
} from '../../services/artifactParser';
import type { Artifact } from '../../types/artifact';
import type { CoworkMessage } from '../../types/cowork';
import { getToolResultDisplay } from './coworkConversationTurns';

export const collectCoworkSessionArtifacts = (
  messages: CoworkMessage[],
  sessionId: string,
): Artifact[] => {
  const artifacts: Artifact[] = [];
  const seenFilePaths = new Set<string>();

  const pushArtifact = (artifact: Artifact): void => {
    if (artifact.filePath) {
      const normalized = normalizeFilePathForDedup(artifact.filePath);
      if (seenFilePaths.has(normalized)) return;
      seenFilePaths.add(normalized);
    }
    artifacts.push(artifact);
  };

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message.type === 'assistant' && !message.metadata?.isThinking && message.content) {
      for (const artifact of parseCodeBlockArtifacts(message.content, message.id, sessionId)) {
        pushArtifact(artifact);
      }

      for (const artifact of parseFileLinksFromMessage(message.content, message.id, sessionId)) {
        pushArtifact(artifact);
      }

      const contentWithoutFileLinks = stripFileLinksFromText(message.content);
      for (const artifact of parseFilePathsFromText(contentWithoutFileLinks, message.id, sessionId)) {
        pushArtifact(artifact);
      }
    }

    if (message.type === 'tool_result') {
      const displayText = getToolResultDisplay(message);
      for (const artifact of parseFilePathsFromText(displayText, message.id, sessionId, 'artifact-toolresult')) {
        pushArtifact(artifact);
      }
    }

    if (message.type === 'tool_use') {
      const toolUseId = message.metadata?.toolUseId;
      const toolResult = typeof toolUseId === 'string' && toolUseId.trim()
        ? messages.find((candidate) => candidate.type === 'tool_result' && candidate.metadata?.toolUseId === toolUseId)
        : messages[index + 1]?.type === 'tool_result'
          ? messages[index + 1]
          : undefined;
      const artifact = parseToolArtifact(message, toolResult, sessionId);
      if (artifact) {
        pushArtifact(artifact);
      }
    }
  }

  return artifacts;
};

