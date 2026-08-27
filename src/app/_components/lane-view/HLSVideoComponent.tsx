"use client";

import React, {MutableRefObject, useEffect, useRef, useState} from 'react';
import type HlsJs from "hls.js";
import {INode} from "@/lib/data/osh/Node";
import {nodeFileServerUrl} from "@/lib/config/RuntimeConfig";

/** Served from the export root; written by scripts/copy-hls-worker.js. */
const HLS_WORKER_PATH = '/hls.worker.js';

export default function HLSVideoComponent({
    videoSource,
    selectedNode,
    height = "500px",
    onRequestRestart,
}: {
    videoSource: string,
    selectedNode: INode,
    height?: string,
    /** Re-arm the server-side stream after a network/404 failure; returns the fresh path. */
    onRequestRestart?: () => Promise<string | null>,
}) {

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef: MutableRefObject<HlsJs | null> = useRef(null);
    const retryRef = useRef(0);
    const [error, setError] = useState<string | null>(null);

    const MAX_RETRIES = 50;

    useEffect(() => {
        if (!videoSource || !selectedNode || !videoRef.current)
            return;

        const src = nodeFileServerUrl(selectedNode, videoSource);

        let destroyed = false;
        retryRef.current = 0;
        setError(null);

        const loadHls = async () => {
            if (typeof window === 'undefined') return;

            const Hls = (await import('hls.js')).default;
            if (destroyed) return;

            const videoEl = videoRef.current;
            if (!videoEl) return;

            // Via the node's own helper, which yields no header at all for a node with no
            // credentials rather than throwing on a null auth.
            const authHeader: Record<string, string> = selectedNode.getBasicAuthHeader();

            // Retry budget applied to playlist and fragment loads so a transient 404 (a
            // segment that rolled out of the short live window) self-heals inside hls.js.
            const errorRetry = {maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 8000};

            const hlsjsConfig = {
                // Transmuxing MUST stay off the main thread: several video widgets
                // on one dashboard put a burst of demux/remux work per segment,
                // per stream, in direct competition with paint.
                //
                // hls.js's DEFAULT inline worker cannot do that here — it
                // stringifies a bootstrap function, and once webpack has wrapped
                // the module that source references helpers absent from worker
                // scope (ReferenceError from the blob: URL), after which hls.js
                // quietly falls back to the main thread. workerPath sidesteps the
                // bundler entirely by loading a real file with `new Worker(url)`;
                // scripts/copy-hls-worker.js keeps it in lockstep with the
                // installed hls.js version at build time.
                //
                // No fallback code needed: hls.js wraps worker setup in try/catch
                // and degrades to inline transmuxing on failure, so the worst case
                // is the behaviour we had before. hls.js also shares one worker per
                // workerPath across every Hls instance, so all the tiles on a page
                // cost one worker between them.
                enableWorker: true,
                workerPath: HLS_WORKER_PATH,
                // The simulator emits ~1s segments with only a few in the live window. Sit
                // right at the live edge; the default sync target sits outside that window
                // and would stall permanently.
                liveSyncDurationCount: 1,
                liveMaxLatencyDurationCount: 4,
                xhrSetup: function (xhr: XMLHttpRequest, url: string) {
                    Object.entries(authHeader).forEach(([k, v]) => xhr.setRequestHeader(k, v));
                    xhr.setRequestHeader("Cache-Control", "no-cache");
                    xhr.withCredentials = true;
                },
                playlistLoadPolicy: {
                    default: {
                        maxTimeToFirstByteMs: 10000,
                        maxLoadTimeMs: 20000,
                        timeoutRetry: {maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0},
                        errorRetry,
                    },
                },
                fragLoadPolicy: {
                    default: {
                        maxTimeToFirstByteMs: 10000,
                        maxLoadTimeMs: 20000,
                        timeoutRetry: {maxNumRetry: 4, retryDelayMs: 0, maxRetryDelayMs: 0},
                        errorRetry,
                    },
                },
            };

            if (!Hls.isSupported()) {
                // Native HLS (Safari): muted + playsInline on the element allow autoplay.
                if (videoEl.canPlayType('application/vnd.apple.mpegURL')) {
                    videoEl.src = src;
                    videoEl.play().catch(() => { /* autoplay policy; muted should permit it */ });
                }
                return;
            }

            const hls = new Hls(hlsjsConfig);
            hlsRef.current = hls;

            hls.on(Hls.Events.ERROR, function (event, data) {
                // Non-fatal errors are recovered internally by hls.js (incl. frag retries).
                if (!data.fatal) return;

                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    // Fatal network error: the stream was likely torn down server-side
                    // (inactivity watchdog) or the manifest 404'd. Re-arm the stream and
                    // reload, backing off between attempts.
                    if (retryRef.current++ < MAX_RETRIES) {
                        const backoff = Math.min(750 * retryRef.current, 5000);
                        setTimeout(async () => {
                            if (destroyed || hlsRef.current !== hls) return;
                            try { await onRequestRestart?.(); } catch { /* keep retrying */ }
                            if (destroyed || hlsRef.current !== hls) return;
                            hls.loadSource(src);
                            hls.startLoad();
                        }, backoff);
                    } else {
                        setError("Unable to load live video stream.");
                    }
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                } else {
                    setError("Live video stream error.");
                    hls.destroy();
                }
            });

            // A successfully loaded fragment means we are healthy again.
            hls.on(Hls.Events.FRAG_LOADED, () => {
                retryRef.current = 0;
                setError(prev => (prev === null ? prev : null));
            });

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current?.play().catch(() => { /* muted autoplay should be allowed */ });
            });

            hls.loadSource(src);
            hls.attachMedia(videoEl);
        };

        loadHls();

        // Browsers throttle background tabs; nudge the loader on return to foreground.
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && hlsRef.current) {
                hlsRef.current.startLoad();
                videoRef.current?.play().catch(() => {});
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            destroyed = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoSource]);

    return (
        <div style={{
            width: '100%',
            height,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <video
                ref={videoRef}
                muted
                playsInline
                style={{width: '100%', height: height, objectFit: 'contain'}}
            />
            {error && (
                <div style={{
                    position: 'absolute',
                    color: '#fff',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '6px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    pointerEvents: 'none',
                }}>
                    {error}
                </div>
            )}
        </div>
    );
}
