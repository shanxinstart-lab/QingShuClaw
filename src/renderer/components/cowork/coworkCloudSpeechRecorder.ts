export interface CloudSpeechRecording {
  stop: () => Promise<{ audioBase64: string; mimeType: string }>;
  cancel: () => Promise<void>;
}

type RecorderState = {
  stream: MediaStream;
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  processorNode: ScriptProcessorNode;
  gainNode: GainNode;
  chunks: Float32Array[];
  sampleRate: number;
};

const mergeChunks = (chunks: Float32Array[]): Float32Array => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
};

const floatTo16BitPcm = (input: Float32Array): Int16Array => {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
};

const writeAscii = (view: DataView, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const encodeWav = (samples: Float32Array, sampleRate: number): Uint8Array => {
  const pcm = floatTo16BitPcm(samples);
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.length * 2, true);

  let offset = 44;
  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(offset, pcm[index], true);
    offset += 2;
  }

  return new Uint8Array(buffer);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const closeRecorderState = async (state: RecorderState): Promise<void> => {
  state.processorNode.disconnect();
  state.sourceNode.disconnect();
  state.gainNode.disconnect();
  state.stream.getTracks().forEach((track) => track.stop());
  await state.audioContext.close();
};

export const startCloudSpeechRecording = async (): Promise<CloudSpeechRecording> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      noiseSuppression: true,
      echoCancellation: true,
    },
  });

  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0;
  const chunks: Float32Array[] = [];

  processorNode.onaudioprocess = (event) => {
    const channelData = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(channelData));
  };

  sourceNode.connect(processorNode);
  processorNode.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const state: RecorderState = {
    stream,
    audioContext,
    sourceNode,
    processorNode,
    gainNode,
    chunks,
    sampleRate: audioContext.sampleRate,
  };

  return {
    stop: async () => {
      await closeRecorderState(state);
      const samples = mergeChunks(state.chunks);
      const wavBytes = encodeWav(samples, state.sampleRate);
      return {
        audioBase64: bytesToBase64(wavBytes),
        mimeType: 'audio/wav',
      };
    },
    cancel: async () => {
      await closeRecorderState(state);
    },
  };
};
