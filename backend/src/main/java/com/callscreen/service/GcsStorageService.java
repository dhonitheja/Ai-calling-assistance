package com.callscreen.service;

import com.google.api.gax.paging.Page;
import com.google.cloud.storage.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * GcsStorageService — all GCS read/write operations in one place.
 *
 * Bucket structure:
 *   calls/<callDir>/transcript.json
 *   calls/<callDir>/summary.txt
 *   calls/<callDir>/audio.wav
 *
 * Lifecycle: bucket has a 48-hour auto-delete policy set via gcloud.
 * Objects older than 2 days are deleted automatically by GCS — no cleanup needed.
 *
 * Auth: Cloud Run uses the attached service account automatically.
 * Locally: set GOOGLE_APPLICATION_CREDENTIALS env var to a service account key JSON.
 */
@Slf4j
@Service
public class GcsStorageService {

    @Value("${gcs.bucket:callscreen-recordings-166891801449}")
    private String bucket;

    private static final String PREFIX     = "calls/";
    private static final String AUDIO_FILE = "audio.wav";

    private Storage storage() {
        return StorageOptions.getDefaultInstance().getService();
    }

    // ─── Write ────────────────────────────────────────────────────────────────

    public void writeBytes(String callDir, String filename, byte[] bytes, String contentType) {
        String objectName = PREFIX + callDir + "/" + filename;
        BlobId   blobId   = BlobId.of(bucket, objectName);
        BlobInfo blobInfo = BlobInfo.newBuilder(blobId).setContentType(contentType).build();
        storage().create(blobInfo, bytes);
        log.debug("GCS write: gs://{}/{}", bucket, objectName);
    }

    public void writeString(String callDir, String filename, String content) {
        writeBytes(callDir, filename, content.getBytes(StandardCharsets.UTF_8), "application/json");
    }

    public void writeSummary(String callDir, String content) {
        writeBytes(callDir, "summary.txt", content.getBytes(StandardCharsets.UTF_8), "text/plain");
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    /** Returns the object bytes, or an empty array if the object does not exist. */
    public byte[] readBytes(String callDir, String filename) {
        String objectName = PREFIX + callDir + "/" + filename;
        Blob blob = storage().get(BlobId.of(bucket, objectName));
        if (blob == null) return new byte[0];
        return blob.getContent();
    }

    /** Returns the object as a String, or null if the object does not exist. */
    public String readString(String callDir, String filename) {
        byte[] bytes = readBytes(callDir, filename);
        if (bytes.length == 0) return null;
        return new String(bytes, StandardCharsets.UTF_8);
    }

    /** Returns the audio bytes, or null if the audio object does not exist. */
    public byte[] readAudioOrNull(String callDir) {
        byte[] bytes = readBytes(callDir, AUDIO_FILE);
        return bytes.length == 0 ? null : bytes;
    }

    public boolean exists(String callDir, String filename) {
        String objectName = PREFIX + callDir + "/" + filename;
        Blob blob = storage().get(BlobId.of(bucket, objectName));
        return blob != null && blob.exists();
    }

    // ─── List call directories ────────────────────────────────────────────────

    /**
     * Lists all call directory names (e.g. "2026-04-14_05-00-00_+13128384016")
     * sorted newest-first.
     */
    public List<String> listCallDirs() {
        List<String> dirs = new ArrayList<>();
        Storage store = storage();
        Page<Blob> page = store.list(bucket,
                Storage.BlobListOption.prefix(PREFIX),
                Storage.BlobListOption.fields(Storage.BlobField.NAME));

        for (Blob blob : page.iterateAll()) {
            String dir = extractCallDir(blob.getName());
            if (dir != null && !dirs.contains(dir)) dirs.add(dir);
        }

        // Sort descending — directory names start with timestamp so lexicographic = chronological
        dirs.sort((a, b) -> b.compareTo(a));
        return dirs;
    }

    /** Extracts "<dir>" from "calls/<dir>/file.txt", or null if the name doesn't match. */
    private String extractCallDir(String objectName) {
        if (!objectName.startsWith(PREFIX)) return null;
        String rest  = objectName.substring(PREFIX.length());
        int    slash = rest.indexOf('/');
        return slash > 0 ? rest.substring(0, slash) : null;
    }

    /** Find the call directory whose transcript.json contains the given callId string. */
    public String findDirByCallId(String callId) {
        for (String dir : listCallDirs()) {
            String transcript = readString(dir, "transcript.json");
            if (transcript != null && transcript.contains(callId)) return dir;
        }
        return null;
    }

    /** Returns a signed URL valid for 1 hour for audio download, or null on error. */
    public InputStream openAudioStream(String callDir) {
        byte[] bytes = readBytes(callDir, AUDIO_FILE);
        if (bytes == null) return null;
        return new java.io.ByteArrayInputStream(bytes);
    }

    public byte[] readAudio(String callDir) {
        return readBytes(callDir, AUDIO_FILE);
    }

    public String getBucketName() { return bucket; }
}
