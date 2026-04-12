package com.callscreen.service;

import com.callscreen.model.SimulateRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * RecordingService — saves every call to local disk.
 *
 * Structure under recordings-dir:
 *   <dir>/2024-01-15_14-32-00_+14155551234/
 *       audio.wav          — PCM/WAV converted from mulaw 8kHz
 *       transcript.json    — full conversation history with timestamps
 *
 * After saving, triggers SelfTrainingService to ingest the transcript into
 * the Pinecone RAG knowledge base so the AI improves after every call.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecordingService {

    @Value("${recordings.dir:./recordings}")
    private String recordingsDir;

    private final SelfTrainingService selfTrainingService;
    private final CallSummaryService callSummaryService;
    private final ObjectMapper mapper = new ObjectMapper();
    private static final DateTimeFormatter DIR_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    /**
     * Called when a call ends. Writes audio + transcript to disk.
     *
     * @param callId     Twilio StreamSid or session ID
     * @param caller     caller phone number (may be null)
     * @param audioChunks raw mulaw 8kHz audio chunks received from Twilio
     * @param history    conversation transcript (user + assistant turns)
     */
    public void saveCallRecording(String callId,
                                   String caller,
                                   List<byte[]> audioChunks,
                                   List<SimulateRequest.ConversationMessage> history) {
        try {
            String ts = LocalDateTime.now().format(DIR_FMT);
            String safeCallerTag = (caller != null && !caller.isBlank())
                    ? caller.replaceAll("[^\\w+]", "") : "unknown";
            String dirName = ts + "_" + safeCallerTag;

            Path callDir = Paths.get(recordingsDir, dirName);
            Files.createDirectories(callDir);

            // 1. Write WAV file
            Path wavPath = callDir.resolve("audio.wav");
            writeWav(wavPath, audioChunks);

            // 2. Write transcript JSON
            Path transcriptPath = callDir.resolve("transcript.json");
            writeTranscript(transcriptPath, callId, caller, ts, history);

            log.info("📼 Call recorded → {} (audio={} transcript={})",
                    callDir, wavPath.getFileName(), transcriptPath.getFileName());

            // Trigger self-training: ingest Q/A pairs into Pinecone RAG
            selfTrainingService.ingestCallTranscript(callId, caller, history);

            // Generate AI summary of the call
            callSummaryService.generateAndSave(callId, caller, ts, history, "AI Agent");

        } catch (Exception e) {
            log.error("Failed to save call recording: {}", e.getMessage(), e);
        }
    }

    // ─── Private helpers ────────────────────────────────────────────────────

    /**
     * Concatenate all mulaw chunks, decode to linear PCM, wrap in WAV header.
     * μ-law is 8-bit, 8kHz mono. Output WAV is 16-bit PCM, 8kHz mono.
     */
    private void writeWav(Path dest, List<byte[]> chunks) throws IOException {
        // Concatenate raw mulaw bytes
        int totalBytes = chunks.stream().mapToInt(c -> c.length).sum();
        byte[] mulaw = new byte[totalBytes];
        int offset = 0;
        for (byte[] c : chunks) {
            System.arraycopy(c, 0, mulaw, offset, c.length);
            offset += c.length;
        }

        // Decode mulaw → 16-bit linear PCM
        short[] pcm = decodeMulaw(mulaw);
        byte[] pcmBytes = shortsToBytes(pcm);

        // Write WAV
        int sampleRate = 8000;
        int numChannels = 1;
        int bitsPerSample = 16;
        int byteRate = sampleRate * numChannels * bitsPerSample / 8;
        int blockAlign = numChannels * bitsPerSample / 8;
        int dataSize = pcmBytes.length;
        int chunkSize = 36 + dataSize;

        try (DataOutputStream dos = new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(dest)))) {
            // RIFF header
            dos.writeBytes("RIFF");
            dos.write(intToLE(chunkSize));
            dos.writeBytes("WAVE");
            // fmt sub-chunk
            dos.writeBytes("fmt ");
            dos.write(intToLE(16));          // subchunk1 size
            dos.write(shortToLE((short) 1)); // PCM = 1
            dos.write(shortToLE((short) numChannels));
            dos.write(intToLE(sampleRate));
            dos.write(intToLE(byteRate));
            dos.write(shortToLE((short) blockAlign));
            dos.write(shortToLE((short) bitsPerSample));
            // data sub-chunk
            dos.writeBytes("data");
            dos.write(intToLE(dataSize));
            dos.write(pcmBytes);
        }
    }

    /** ITU-T G.711 μ-law to 16-bit linear PCM decode */
    private short[] decodeMulaw(byte[] mulaw) {
        short[] pcm = new short[mulaw.length];
        for (int i = 0; i < mulaw.length; i++) {
            int u = (~mulaw[i]) & 0xFF;
            int exponent = (u >> 4) & 0x07;
            int mantissa = u & 0x0F;
            int sample = ((mantissa << 3) + 132) << exponent;
            sample -= 132;
            if ((u & 0x80) == 0) sample = -sample;
            pcm[i] = (short) Math.max(Short.MIN_VALUE, Math.min(Short.MAX_VALUE, sample));
        }
        return pcm;
    }

    private byte[] shortsToBytes(short[] shorts) {
        byte[] bytes = new byte[shorts.length * 2];
        for (int i = 0; i < shorts.length; i++) {
            bytes[i * 2]     = (byte) (shorts[i] & 0xFF);
            bytes[i * 2 + 1] = (byte) ((shorts[i] >> 8) & 0xFF);
        }
        return bytes;
    }

    private byte[] intToLE(int v) {
        return new byte[]{(byte)(v),(byte)(v>>8),(byte)(v>>16),(byte)(v>>24)};
    }

    private byte[] shortToLE(short v) {
        return new byte[]{(byte)(v),(byte)(v>>8)};
    }

    private void writeTranscript(Path dest, String callId, String caller, String ts,
                                  List<SimulateRequest.ConversationMessage> history) throws IOException {
        ObjectNode root = mapper.createObjectNode();
        root.put("callId", callId);
        root.put("caller", caller != null ? caller : "unknown");
        root.put("timestamp", ts);
        root.put("turns", history != null ? history.size() : 0);

        ArrayNode turns = mapper.createArrayNode();
        if (history != null) {
            for (SimulateRequest.ConversationMessage msg : history) {
                ObjectNode turn = mapper.createObjectNode();
                turn.put("role", msg.getRole());
                turn.put("content", msg.getContent());
                turns.add(turn);
            }
        }
        root.set("transcript", turns);

        mapper.writerWithDefaultPrettyPrinter().writeValue(dest.toFile(), root);
    }
}
