<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import {
        Room,
        RoomEvent,
        RemoteParticipant,
        RemoteTrackPublication,
        type RemoteTrack,
        type Participant,
    } from "livekit-client";
    import { connectionState } from "../stores/connection";
    import { mode } from "../stores/mode";
    import { scores } from "../stores/scores";
    import {
        availableStreams,
        selectedSource,
        type StreamInfo,
    } from "../stores/streams";

    // --- State ---
    let localRoom: Room | null = $state(null);
    let wsConnection: WebSocket | null = $state(null);
    let allStreams = $state<StreamInfo[]>([]);
    let activeSourceSid = $state<string | null>(null);

    // Ensure StreamInfo.participant is never undefined
    interface SafeStreamInfo extends StreamInfo {
        participant: RemoteParticipant;
    }

    // --- Derived State ---
    let game1Streams = $derived(
        allStreams.filter(
            (s) =>
                s.phase === "semi" && s.game === "game1" && s.videoPublication,
        ) as SafeStreamInfo[],
    );
    let game2Streams = $derived(
        allStreams.filter(
            (s) =>
                s.phase === "semi" && s.game === "game2" && s.videoPublication,
        ) as SafeStreamInfo[],
    );
    let angleStreams = $derived(
        allStreams.filter(
            (s) => s.phase === "final" && s.videoPublication,
        ) as SafeStreamInfo[],
    );
    let activeStream = $derived(
        angleStreams.find((s) => s.participant.sid === activeSourceSid) as
            | SafeStreamInfo
            | undefined,
    );

    // --- Effects ---

    // Update stores based on local state
    $effect(() => {
        $availableStreams = allStreams;
    });

    $effect(() => {
        $selectedSource = activeSourceSid;
    });

    // React to external store changes
    $effect(() => {
        const selected = $selectedSource; // Track dependency
        if (selected && selected !== activeSourceSid) {
            console.log("Selected source changed externally:", selected);
            activeSourceSid = selected;
        }
    });

    // Effect to attach video/audio tracks
    function attachMedia(stream: SafeStreamInfo, videoElementId: string) {
        $effect(() => {
            const videoElement = document.getElementById(
                videoElementId,
            ) as HTMLVideoElement;
            if (!videoElement) return;

            const videoTrack = stream.videoPublication?.track;
            const audioTrack = stream.audioPublication?.track;

            if (videoTrack) {
                console.log(
                    `Attaching video track ${videoTrack.sid} to ${videoElementId}`,
                );
                videoTrack.attach(videoElement);
            }
            if (audioTrack) {
                console.log(
                    `Attaching audio track ${audioTrack.sid} to ${videoElementId}`,
                );
                // Note: Attaching audio to video element is common practice
                audioTrack.attach(videoElement);
            }

            return () => {
                if (videoTrack) {
                    console.log(
                        `Detaching video track ${videoTrack.sid} from ${videoElementId}`,
                    );
                    videoTrack.detach(videoElement);
                }
                if (audioTrack) {
                    console.log(
                        `Detaching audio track ${audioTrack.sid} from ${videoElementId}`,
                    );
                    audioTrack.detach(videoElement);
                }
            };
        });
    }

    // --- WebSocket Connection ---
    function connectWebSocket() {
        try {
            $connectionState.websocket = "connecting";
            const wsUrl = `${import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws"}`;
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log("WebSocket connected");
                $connectionState.websocket = "connected";
                wsConnection = ws;
            };

            ws.onclose = () => {
                console.log("WebSocket disconnected");
                if (wsConnection === ws) {
                    // Prevent action if a new connection replaced this one
                    wsConnection = null;
                    $connectionState.websocket = "disconnected";
                    // Try to reconnect after a delay if not intentionally closed
                    setTimeout(() => {
                        if (
                            $connectionState.websocket !== "connected" &&
                            !localRoom?.state
                        ) {
                            // Check if component is still mounted implicitly
                            connectWebSocket();
                        }
                    }, 3000);
                }
            };

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                if (wsConnection === ws) {
                    wsConnection = null;
                    $connectionState.websocket = "error";
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    $scores = data; // Update score store
                    if (data.phase && data.phase !== $mode) {
                        console.log("Mode changed via WebSocket:", data.phase);
                        $mode = data.phase; // Update mode store
                    }
                } catch (err) {
                    console.error("Error processing WebSocket message:", err);
                }
            };
        } catch (err) {
            console.error("WebSocket connection error:", err);
            $connectionState.websocket = "error";
        }
    }

    // --- LiveKit Connection ---
    async function connectLiveKit() {
        try {
            $connectionState.livekit = "connecting";
            const currentMode = $mode; // Use stable value within async function

            // Get token
            const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
            const response = await fetch(
                `${apiBaseUrl}/api/token?type=output&phase=${currentMode}`,
                { method: "GET" },
            );
            if (!response.ok) {
                throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
            }
            
            // Debug the raw response before parsing
            const responseText = await response.text();
            console.log("Token API response:", responseText);
            
            // Try to parse the response as JSON
            let tokenData;
            try {
                tokenData = JSON.parse(responseText);
            } catch (parseErr) {
                console.error("JSON parse error:", parseErr);
                throw new Error(`Invalid JSON response from token API: ${responseText.substring(0, 100)}...`);
            }
            
            const { token, room: roomName } = tokenData;

            // Create and connect room
            const room = new Room();
            localRoom = room; // Assign to state

            try {
                const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
                console.log(`Connecting to LiveKit at ${livekitUrl}`);
                await room.connect(livekitUrl, token);
                console.log("LiveKit connected to room:", roomName);
                $connectionState.livekit = "connected";
            } catch (connectErr: any) { // Type annotation to handle unknown type
                console.error("LiveKit room.connect error:", connectErr);
                
                // Check for specific API key error
                if (connectErr.message && connectErr.message.includes("invalid API key")) {
                    $connectionState.errorMessage = "LiveKit API key is invalid or expired. Please contact the administrator.";
                    throw new Error("LiveKit connection failed: Invalid API key. The API key may be expired or misconfigured.");
                }
                
                throw connectErr; // Re-throw to be caught by outer try block
            }

            // --- LiveKit Event Handlers ---
            room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
            room.on(
                RoomEvent.ParticipantDisconnected,
                handleParticipantDisconnected,
            );
            room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
            room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
            room.on(RoomEvent.DataReceived, handleDataReceived);

            // Process existing participants
            room.remoteParticipants.forEach(handleParticipantConnected);
        } catch (err) {
            console.error("LiveKit connection error:", err);
            $connectionState.livekit = "error";
            $connectionState.errorMessage =
                err instanceof Error 
                    ? `${err.name}: ${err.message}` 
                    : "Unknown error";
            if (localRoom) {
                await localRoom.disconnect();
                localRoom = null;
            }
        }
    }

    function handleParticipantConnected(participant: RemoteParticipant) {
        console.log(
            "Participant connected:",
            participant.identity,
            participant.metadata,
        );
        try {
            if (participant.metadata) {
                const metadata = JSON.parse(participant.metadata);
                if (metadata.phase) {
                    // Expecting phase in metadata for valid sources
                    // Create a new stream entry
                    const newStream: StreamInfo = {
                        participant,
                        phase: metadata.phase,
                        game: metadata.game || "final",
                        angle: metadata.angle || "main",
                        videoPublication: undefined, // Will be populated by TrackSubscribed
                        audioPublication: undefined,
                    };
                    // Avoid duplicates
                    if (
                        !allStreams.some(
                            (s) => s.participant.sid === participant.sid,
                        )
                    ) {
                        allStreams = [...allStreams, newStream];
                    }

                    // Auto-select first stream if in final mode and none selected
                    if (
                        $mode === "final" &&
                        !activeSourceSid &&
                        metadata.phase === "final"
                    ) {
                        console.log(
                            "Auto-selecting final stream:",
                            participant.sid,
                        );
                        activeSourceSid = participant.sid;
                    }

                    // Subscribe to existing tracks immediately
                    participant.trackPublications.forEach((pub) => {
                        if (pub.track && pub.isSubscribed) {
                            handleTrackSubscribed(pub.track, pub, participant);
                        }
                    });
                } else {
                    console.warn(
                        "Participant connected without phase metadata:",
                        participant.identity,
                    );
                }
            } else {
                console.warn(
                    "Participant connected without metadata:",
                    participant.identity,
                );
            }
        } catch (err) {
            console.error("Error processing participant metadata:", err);
        }
    }

    function handleParticipantDisconnected(participant: RemoteParticipant) {
        console.log("Participant disconnected:", participant.identity);
        allStreams = allStreams.filter(
            (s) => s.participant.sid !== participant.sid,
        );
        if (activeSourceSid === participant.sid) {
            console.log("Active source disconnected, clearing selection.");
            activeSourceSid = null;
            // Optionally, select the next available final stream if in final mode
            if ($mode === "final") {
                const nextFinalStream = angleStreams.find(
                    (s) => s.participant.sid !== participant.sid,
                );
                if (nextFinalStream) {
                    console.log(
                        "Selecting next available final stream:",
                        nextFinalStream.participant.sid,
                    );
                    activeSourceSid = nextFinalStream.participant.sid;
                }
            }
        }
    }

    function updateStreamPublication(
        participantSid: string,
        publication: RemoteTrackPublication,
        subscribed: boolean,
    ) {
        const streamIndex = allStreams.findIndex(
            (s) => s.participant.sid === participantSid,
        );
        if (streamIndex === -1) return;

        // Get the current stream and ensure all required fields are present
        const currentStream = allStreams[streamIndex];
        if (!currentStream || !currentStream.participant) return;

        // Create a properly typed updated stream
        const updatedStream: StreamInfo = {
            participant: currentStream.participant,
            phase: currentStream.phase || "final",
            game: currentStream.game || "final",
            angle: currentStream.angle || "main",
            videoPublication:
                publication.kind === "video"
                    ? subscribed
                        ? publication
                        : undefined
                    : currentStream.videoPublication,
            audioPublication:
                publication.kind === "audio"
                    ? subscribed
                        ? publication
                        : undefined
                    : currentStream.audioPublication,
        };

        // Create a new array to trigger reactivity
        const newStreams = [...allStreams];
        newStreams[streamIndex] = updatedStream;
        allStreams = newStreams;
    }

    function handleTrackSubscribed(
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
    ) {
        console.log(
            `Track subscribed: ${track.kind} from ${participant.identity} (SID: ${track.sid})`,
        );
        
        // Update stream info
        updateStreamPublication(participant.sid, publication, true);
        
        // Directly attach tracks
        if (track.kind === "video") {
            // For video tracks, find the right video element
            let elementId: string | null = null;
            
            // Check if this is for a semi-final or final stream
            const streamInfo = allStreams.find(s => s.participant.sid === participant.sid);
            if (streamInfo) {
                if (streamInfo.phase === "semi" && streamInfo.game === "game1") {
                    elementId = `video-game1-${participant.sid}`;
                } else if (streamInfo.phase === "semi" && streamInfo.game === "game2") {
                    elementId = `video-game2-${participant.sid}`;
                } else if (streamInfo.phase === "final") {
                    elementId = `video-final-${participant.sid}`;
                } else {
                    elementId = `video-${participant.sid}`;
                }
                
                // Try to attach the track immediately
                const videoEl = document.getElementById(elementId) as HTMLVideoElement | null;
                if (videoEl) {
                    console.log(`Attaching video track to ${elementId}`);
                    track.attach(videoEl);
                } else {
                    // If video element doesn't exist yet, try again after a delay
                    console.log(`Video element ${elementId} not found, trying again in 500ms`);
                    setTimeout(() => {
                        const retryEl = document.getElementById(elementId!) as HTMLVideoElement | null;
                        if (retryEl) {
                            console.log(`Delayed attachment to ${elementId} successful`);
                            track.attach(retryEl);
                        } else {
                            console.warn(`Failed to find video element ${elementId} after delay`);
                        }
                    }, 500);
                }
            }
        }
    }

    function handleTrackUnsubscribed(
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
    ) {
        console.log(
            `Track unsubscribed: ${track.kind} from ${participant.identity}`,
        );
        updateStreamPublication(participant.sid, publication, false);
    }

    function handleDataReceived(
        payload: Uint8Array,
        participant?: Participant,
    ) {
        try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            if (data.action === "switch_source" && data.targetSid) {
                console.log("Received switch source command:", data.targetSid);
                // Ensure the target SID actually exists among angle streams
                if (
                    angleStreams.some(
                        (s) => s.participant.sid === data.targetSid,
                    )
                ) {
                    activeSourceSid = data.targetSid;
                } else {
                    console.warn(
                        "Received switch command for non-existent/non-final stream:",
                        data.targetSid,
                    );
                }
            }
        } catch (err) {
            console.error("Error processing data message:", err);
        }
    }

    // --- Lifecycle ---
    onMount(() => {
        console.log("Output component mounted");
        connectWebSocket();
        connectLiveKit();
    });

    onDestroy(async () => {
        console.log("Output component destroying");
        if (localRoom) {
            console.log("Disconnecting LiveKit room");
            await localRoom.disconnect();
            localRoom = null;
        }
        if (wsConnection) {
            console.log("Closing WebSocket connection");
            wsConnection.close();
            wsConnection = null; // Ensure state is cleared
        }
    });
</script>

<div class="output-container">
    <!-- Connection error display -->
    {#if $connectionState.livekit === "error"}
        <div class="error-overlay">
            <div class="error-message">
                <h3>Connection Error</h3>
                <p>{$connectionState.errorMessage || "Failed to connect to video stream."}</p>
                <button onclick={() => connectLiveKit()}>Retry Connection</button>
            </div>
        </div>
    {/if}
    
    <!-- Semi-finals mode -->
    {#if $mode === "semi"}
        <div class="semi-output">
            <!-- Game 1 -->
            <div class="game-container top">
                {#if game1Streams.length > 0}
                    <!-- Only render the first game1 stream for simplicity, assuming one per game -->
                    {@const stream = game1Streams[0]}
                    {#if stream}
                        {#key stream.participant.sid}
                            <div class="video-wrapper">
                                <video
                                    id={`video-game1-${stream.participant.sid}`}
                                    autoplay
                                    playsinline
                                >
                                    <track kind="captions" />
                                </video>
                                {attachMedia(
                                    stream,
                                    `video-game1-${stream.participant.sid}`,
                                )}
                            </div>
                            <!-- Score overlay for Game 1 -->
                            {#if $scores?.scores?.game1}
                                <div class="score-overlay">
                                    {#each Object.entries($scores.scores.game1) as [className, score], i}
                                        <div class="team-score">
                                            <span class="team-name"
                                                >{className}</span
                                            >
                                            <span class="score">{score}</span>
                                        </div>
                                        {#if i === 0}<div class="score-divider">
                                                :
                                            </div>{/if}
                                    {/each}
                                </div>
                            {/if}
                        {/key}
                    {/if}
                {:else}
                    <div class="placeholder">等待 Game 1 視訊...</div>
                {/if}
            </div>

            <!-- Game 2 -->
            <div class="game-container bottom">
                {#if game2Streams.length > 0}
                    <!-- Only render the first game2 stream for simplicity -->
                    {@const stream = game2Streams[0]}
                    {#if stream}
                        {#key stream.participant.sid}
                            <div class="video-wrapper">
                                <video
                                    id={`video-game2-${stream.participant.sid}`}
                                    autoplay
                                    playsinline
                                >
                                    <track kind="captions" />
                                </video>
                                {attachMedia(
                                    stream,
                                    `video-game2-${stream.participant.sid}`,
                                )}
                            </div>
                            <!-- Score overlay for Game 2 -->
                            {#if $scores?.scores?.game2}
                                <div class="score-overlay">
                                    {#each Object.entries($scores.scores.game2) as [className, score], i}
                                        <div class="team-score">
                                            <span class="team-name"
                                                >{className}</span
                                            >
                                            <span class="score">{score}</span>
                                        </div>
                                        {#if i === 0}<div class="score-divider">
                                                :
                                            </div>{/if}
                                    {/each}
                                </div>
                            {/if}
                        {/key}
                    {/if}
                {:else}
                    <div class="placeholder">等待 Game 2 視訊...</div>
                {/if}
            </div>
        </div>

        <!-- Finals mode -->
    {:else if $mode === "final"}
        <div class="final-output">
            {#if activeStream}
                {#key activeStream.participant.sid}
                    <div class="video-wrapper">
                        <video
                            id={`video-final-${activeStream.participant.sid}`}
                            autoplay
                            playsinline
                        >
                            <track kind="captions" />
                        </video>
                        {attachMedia(
                            activeStream,
                            `video-final-${activeStream.participant.sid}`,
                        )}
                    </div>
                    <!-- Score overlay for Finals -->
                    {#if $scores?.scores?.final}
                        <div class="score-overlay final">
                            {#each Object.entries($scores.scores.final) as [className, score], i}
                                <div class="team-score">
                                    <span class="team-name">{className}</span>
                                    <span class="score">{score}</span>
                                </div>
                                {#if i === 0}<div class="score-divider">
                                        :
                                    </div>{/if}
                            {/each}
                        </div>
                    {/if}
                {/key}
            {:else}
                <div class="placeholder">等待決賽視訊...</div>
            {/if}
        </div>
    {:else}
        <div class="placeholder">等待模式設定...</div>
    {/if}
</div>

<style>
    .output-container {
        width: 100%;
        height: 100vh;
        background-color: black;
        overflow: hidden;
        /* 9:16 aspect ratio */
        max-width: calc(100vh * 9 / 16);
        margin: 0 auto;
        position: relative; /* Needed for absolute positioning of overlays */
    }

    .semi-output {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .game-container {
        position: relative;
        flex: 1;
        overflow: hidden;
        display: flex; /* Use flex to center placeholder */
        justify-content: center;
        align-items: center;
    }

    .game-container.top {
        border-bottom: 2px solid white;
    }

    .final-output {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex; /* Use flex to center placeholder */
        justify-content: center;
        align-items: center;
    }

    .video-wrapper {
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: absolute; /* Make wrapper cover container */
        top: 0;
        left: 0;
    }

    video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block; /* Remove extra space below video */
    }

    .placeholder {
        color: #ccc;
        font-size: 1.2rem;
        text-align: center;
    }

    .score-overlay {
        position: absolute;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        z-index: 10; /* Ensure overlay is above video */
    }

    .score-overlay.final {
        padding: 0.75rem 1.5rem;
        font-size: 1.2rem;
    }

    .team-score {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 0.5rem;
    }

    .team-name {
        font-size: 0.9rem;
        font-weight: bold;
        white-space: nowrap;
    }

    .score {
        font-size: 1.8rem;
        font-weight: bold;
    }

    .score-divider {
        font-size: 1.8rem;
        margin: 0 0.5rem;
        font-weight: bold;
    }
    
    /* Error display styles */
    .error-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .error-message {
        background-color: #f8d7da;
        border: 1px solid #f5c2c7;
        color: #842029;
        padding: 1.5rem;
        border-radius: 8px;
        max-width: 90%;
        text-align: center;
    }
    
    .error-message h3 {
        margin-top: 0;
        font-size: 1.5rem;
    }
    
    .error-message button {
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background-color: #0d6efd;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .error-message button:hover {
        background-color: #0b5ed7;
    }
</style>
