package com.callscreen.service;

import com.callscreen.model.SimulateRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * RecordingService — saves every call to Google Cloud Storage.
 *
 * Structure in GCS bucket (callscreen-recordings-*):
 *   calls/<timestamp>_<caller>/transcript.json
 *   calls/<timestamp>_<caller>/summary.txt
 *   calls/<timestamp>_<caller>/audio.wav
 *
 * The bucket has a 48-hour lifecycle policy — objects auto-delete after 2 days.
 * No cleanup code needed; GCS handles it automatically.
 *
 * After saving, triggers:
 *  1. SelfTrainingService — ingest Q/A into Pinecone RAG
 *  2. CallSummaryService  — generate AI summary via Claude
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecordingService {

    private final GcsStorageService gcs;
    private final SelfTrainingService selfTrainingService;
    private final CallSummaryService callSummaryService;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final DateTimeFormatter DIR_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    public void saveCallRecording(String callId,
                                   String caller,
                                   List<byte[]> audioChunks,
                                   List<SimulateRequest.ConversationMessage> history) {
        try {
            String ts = LocalDateTime.now().format(DIR_FMT);
            String safeCallerTag = (caller != null && !caller.isBlank())
                    ? caller.replaceAll("[^\\w+]", "") : "unknown";
            String dirName = ts + "_" + safeCallerTag;

            // 1. Write WAV to GCS
            byte[] wavBytes = buildWav(audioChunks);
            gcs.writeBytes(dirName, "audio.wav", wavBytes, "audio/wav");

            // 2. Write transcript JSON to GCS
            byte[] transcriptBytes = buildTranscriptJson(callId, caller, ts, history);
            gcs.writeBytes(dirName, "transcript.json", transcriptBytes, "application/json");

            log.info("📼 Call saved to GCS: calls/{} (audio={} bytes, turns={})",
                    dirName, wavBytes.length, history != null ? history.size() : 0);

            // Async: self-training + summary (non-blocking)
            selfTrainingService.ingestCallTranscript(callId, caller, history);
            callSummaryService.generateAndSave(callId, caller, ts, history, "AI Agent");

        } catch (Exception e) {
            log.error("Failed to save call recording to GCS: {}", e.getMessage(), e);
        }
    }

    // ─── WAV builder ─────────────────────────────────────────────────────────

    private byte[] buildWav(List<byte[]> chunks) throws IOException {
        int totalBytes = chunks.stream().mapToInt(c -> c.length).sum();
        byte[] mulaw = new byte[totalBytes];
        int offset = 0;
        for (byte[] c : chunks) { System.arraycopy(c, 0, mulaw, offset, c.length); offset += c.length; }

        short[] pcm     = decodeMulaw(mulaw);
        byte[]  pcmBytes = shortsToBytes(pcm);

        int sampleRate   = 8000;
        int numChannels  = 1;
        int bitsPerSample = 16;
        int byteRate     = sampleRate * numChannels * bitsPerSample / 8;
        int blockAlign   = numChannels * bitsPerSample / 8;
        int dataSize     = pcmBytes.length;
        int chunkSize    = 36 + dataSize;

        ByteArrayOutputStream baos = new ByteArrayOutputStream(44 + dataSize);
        DataOutputStream dos = new DataOutputStream(baos);
        dos.writeBytes("RIFF");
        dos.write(intToLE(chunkSize));
        dos.writeBytes("WAVE");
        dos.writeBytes("fmt ");
        dos.write(intToLE(16));
        dos.write(shortToLE((short) 1));
        dos.write(shortToLE((short) numChannels));
        dos.write(intToLE(sampleRate));
        dos.write(intToLE(byteRate));
        dos.write(shortToLE((short) blockAlign));
        dos.write(shortToLE((short) bitsPerSample));
        dos.writeBytes("data");
        dos.write(intToLE(dataSize));
        dos.write(pcmBytes);
        dos.flush();
        return baos.toByteArray();
    }

    private short[] decodeMulaw(byte[] mulaw) {
        short[] pcm = new short[mulaw.length];
        for (int i = 0; i < mulaw.length; i++) {
            int u = (~mulaw[i]) & 0xFF;
            int exponent = (u >> 4) & 0x07;
            int mantissa = u & 0x0F;
            int sample = ((mantissa << 3) + 132) << exponent;
            sample -= 132;
            if ((u & 0x80) == 0) sample = -sample;
            pcm[i] = (short) Math.clamp(sample, Short.MIN_VALUE, Short.MAX_VALUE);
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

    private byte[] intToLE(int v)   { return new byte[]{(byte)v,(byte)(v>>8),(byte)(v>>16),(byte)(v>>24)}; }
    private byte[] shortToLE(short v) { return new byte[]{(byte)v,(byte)(v>>8)}; }

    // ─── Transcript JSON builder ──────────────────────────────────────────────

    private byte[] buildTranscriptJson(String callId, String caller, String ts,
                                        List<SimulateRequest.ConversationMessage> history) throws java.io.IOException {
        ObjectNode root = mapper.createObjectNode();
        root.put("callId",    callId);
        root.put("caller",    caller != null ? caller : "unknown");
        root.put("timestamp", ts);
        root.put("turns",     history != null ? history.size() : 0);

        ArrayNode turns = mapper.createArrayNode();
        if (history != null) {
            for (SimulateRequest.ConversationMessage msg : history) {
                ObjectNode turn = mapper.createObjectNode();
                turn.put("role",    msg.getRole());
                turn.put("content", msg.getContent());
                turns.add(turn);
            }
        }
        root.set("transcript", turns);
        return mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(root);
    }
}
