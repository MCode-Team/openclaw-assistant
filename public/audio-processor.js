// AudioWorklet Processor - Used to capture raw PCM audio data
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (input && input.length > 0) {
      const channelData = input[0]; // Get the first channel

      if (channelData && channelData.length > 0) {
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
          // Convert floating point from -1.0 to 1.0 back to -32768 to 32767 integer
          const s = Math.max(-1, Math.min(1, channelData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send PCM data to the main thread
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
      }
    }

    return true; // Keep the processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
