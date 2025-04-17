<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        Room,
        RoomEvent,
        RemoteParticipant,
        RemoteTrack,
        RemoteTrackPublication,
    } from "livekit-client";
    import { connectionState } from "../stores/connection";
    import { mode } from "../stores/mode";
    import { scores } from "../stores/scores";
    import {
        availableStreams,
        selectedSource,
        type StreamInfo,
    } from "../stores/streams";

    // Local state
    let localRoom = $state<Room | null>(null);
    let wsConnection = $state<WebSocket | null>(null);
    let streams = $state<StreamInfo[]>([]);

    // Derived values
    let game1Streams = $derived(
        streams.filter(
            (s) =>
                s.phase === "semi" && s.game === "game1" && s.videoPublication,
        ),
    );
    let game2Streams = $derived(
        streams.filter(
            (s) =>
                s.phase === "semi" && s.game === "game2" && s.videoPublication,
        ),
    );
    let angleStreams = $derived(
        streams.filter((s) => s.phase === "final" && s.videoPublication),
    );

    // Update the availableStreams store
    $effect(() => {
        $availableStreams = streams;
    });

    // Connect to backend WebSocket for score updates
    function connectWebSocket() {
        try {
            $connectionState.websocket = "connecting";

            const wsUrl = `${import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws"}`;
            wsConnection = new WebSocket(wsUrl);

            // Set up WebSocket event handlers
            wsConnection.onopen = () => {
                console.log("WebSocket connected");
                $connectionState.websocket = "connected";
            };

            wsConnection.onclose = () => {
                console.log("WebSocket disconnected");
                $connectionState.websocket = "disconnected";

                // Try to reconnect after a delay
                setTimeout(() => {
                    if ($connectionState.websocket !== "connected") {
                        connectWebSocket();
                    }
                }, 3000);
            };

            wsConnection.onerror = (err) => {
                console.error("WebSocket error:", err);
                $connectionState.websocket = "error";
            };

            wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Update score store with received data
                    $scores = data;
                } catch (err) {
                    console.error("Error processing WebSocket message:", err);
                }
            };
        } catch (err) {
            console.error("WebSocket connection error:", err);
            $connectionState.websocket = "error";
        }
    }

    // Connect to LiveKit
    async function connectLiveKit() {
        try {
            $connectionState.livekit = "connecting";
            const currentMode = $mode; // Use stable value within async function

            // Get token from backend
            const apiBaseUrl =
                import.meta.env.VITE_API_URL || "http://localhost:8080";
            const response = await fetch(
                `${apiBaseUrl}/api/token?type=admin&phase=${currentMode}`,
                { method: "GET" },
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to get token: ${response.status} ${response.statusText}`,
                );
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
                throw new Error(
                    `Invalid JSON response from token API: ${responseText.substring(0, 100)}...`,
                );
            }

            const { token, room: roomName } = tokenData;

            // Connect to LiveKit room
            const room = new Room();
            localRoom = room;

            try {
                const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
                console.log(`Connecting to LiveKit at ${livekitUrl}`);
                await room.connect(livekitUrl, token);
                console.log("LiveKit connected to room:", roomName);
                $connectionState.livekit = "connected";
            } catch (connectErr: any) {
                // Type annotation to handle unknown type
                console.error("LiveKit room.connect error:", connectErr);

                // Check for specific API key error
                if (
                    connectErr.message &&
                    connectErr.message.includes("invalid API key")
                ) {
                    $connectionState.errorMessage =
                        "LiveKit API key is invalid or expired. Please contact the administrator.";
                    throw new Error(
                        "LiveKit connection failed: Invalid API key. The API key may be expired or misconfigured.",
                    );
                }

                throw connectErr; // Re-throw to be caught by outer try block
            }

            // Set up event listeners
            room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
            room.on(
                RoomEvent.ParticipantDisconnected,
                handleParticipantDisconnected,
            );
            room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
            room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

            // Process existing participants
            Array.from(room.remoteParticipants.values()).forEach(
                (participant: RemoteParticipant) => {
                    handleParticipantConnected(participant);
                },
            );

            // Update UI state
            $connectionState.livekit = "connected";
        } catch (err) {
            console.error("LiveKit connection error:", err);
            $connectionState.livekit = "error";
            $connectionState.errorMessage =
                err instanceof Error ? err.message : "Unknown error";
        }
    }

    // Handle new participant connected
    function handleParticipantConnected(participant: RemoteParticipant) {
        console.log("Participant connected:", participant.identity);

        // Process metadata to understand participant's role
        try {
            if (participant.metadata) {
                const metadata = JSON.parse(participant.metadata);

                // Only add camera participants to the streams array
                if (metadata.phase) {
                    // Create a new stream entry
                    const streamInfo: StreamInfo = {
                        participant,
                        phase: metadata.phase,
                        game: metadata.game,
                        angle: metadata.angle,
                    };

                    // Add to streams array
                    streams = [...streams, streamInfo];

                    // Subscribe to any existing publications
                    participant.trackPublications.forEach((publication) => {
                        processTrackPublication(participant, publication);
                    });
                }
            }
        } catch (err) {
            console.error("Error processing participant metadata:", err);
        }
    }

    // Handle participant disconnected
    function handleParticipantDisconnected(participant: RemoteParticipant) {
        console.log("Participant disconnected:", participant.identity);

        // Remove from streams array
        streams = streams.filter((s) => s.participant.sid !== participant.sid);
    }

    // Handle new track subscription
    function handleTrackSubscribed(
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
    ) {
        console.log(
            "Track subscribed:",
            track.kind,
            "from",
            participant.identity,
        );
        
        // First, update the publication in our streams array
        processTrackPublication(participant, publication);
        
        // Then, immediately attach the track if it's video
        if (track.kind === "video") {
            const videoEl = document.getElementById(
                `video-${participant.sid}`
            ) as HTMLVideoElement | null;
            
            if (videoEl) {
                console.log(`Direct track attachment to video-${participant.sid}`);
                track.attach(videoEl);
            } else {
                // If element isn't found immediately, try again after a short delay
                console.log(`Delaying track attachment for video-${participant.sid}`);
                setTimeout(() => {
                    const retryEl = document.getElementById(
                        `video-${participant.sid}`
                    ) as HTMLVideoElement | null;
                    
                    if (retryEl) {
                        console.log(`Delayed track attachment to video-${participant.sid} successful`);
                        track.attach(retryEl);
                    } else {
                        console.warn(`Failed to find video element for ${participant.sid} after delay`);
                    }
                }, 500);
            }
        }
    }

    // Handle track unsubscription
    function handleTrackUnsubscribed(
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
    ) {
        // Update streams array, removing the track reference
        streams = streams.map((stream) => {
            if (stream.participant.sid === participant.sid) {
                if (publication.kind === "video") {
                    return { ...stream, videoPublication: undefined };
                } else if (publication.kind === "audio") {
                    return { ...stream, audioPublication: undefined };
                }
            }
            return stream;
        });
    }

    // Process track publication
    function processTrackPublication(
        participant: RemoteParticipant,
        publication: RemoteTrackPublication,
    ) {
        // Find the stream for this participant
        const streamIndex = streams.findIndex(
            (s) => s.participant.sid === participant.sid,
        );

        if (streamIndex >= 0) {
            // Update streams array with the new publication
            const updatedStreams = [...streams];
            const stream = updatedStreams[streamIndex];

            // Only proceed if the stream exists
            if (stream) {
                if (publication.kind === "video") {
                    stream.videoPublication = publication;
                } else if (publication.kind === "audio") {
                    stream.audioPublication = publication;
                }

                streams = updatedStreams;
            }
        }
    }

    // Switch to selected source in finals mode
    function switchSource(participantSid: string) {
        if (!localRoom || $mode !== "final") return;
        const participant = localRoom.localParticipant;
        if (!participant) return;

        try {
            // Update the selected source store
            $selectedSource = participantSid;

            // Send message via DataChannel to Output
            const message = JSON.stringify({
                action: "switch_source",
                targetSid: participantSid,
            });

            participant.publishData(
                new Uint8Array(new TextEncoder().encode(message)),
                { reliable: true },
            );

            console.log("Source switch message sent:", participantSid);
        } catch (err) {
            console.error("Error switching source:", err);
        }
    }

    // Toggle between semi and final modes
    function toggleMode() {
        $mode = $mode === "semi" ? "final" : "semi";

        // Reconnect to LiveKit when mode changes
        if (localRoom) {
            localRoom.disconnect();
            connectLiveKit();
        }
    }

    // Clean up on component destruction
    onDestroy(() => {
        if (localRoom) {
            localRoom.disconnect();
            localRoom = null;
        }

        if (wsConnection) {
            wsConnection.close();
            wsConnection = null;
        }
    });

    // Initialize when component mounts
    onMount(() => {
        connectWebSocket();
        connectLiveKit();

        // Return cleanup function
        return () => {
            if (localRoom) {
                localRoom.disconnect();
            }

            if (wsConnection) {
                wsConnection.close();
            }
        };
    });

    // Helper functions for video attachments
    function attachVideoTrack(
        elementId: string,
        publication?: RemoteTrackPublication,
    ) {
        if (!publication?.track) return;

        const element = document.getElementById(
            elementId,
        ) as HTMLVideoElement | null;
        if (!element) return;

        publication.track.attach(element);
    }

    function detachVideoTrack(
        elementId: string,
        publication?: RemoteTrackPublication,
    ) {
        if (!publication?.track) return;

        const element = document.getElementById(
            elementId,
        ) as HTMLVideoElement | null;
        if (!element) return;

        publication.track.detach(element);
    }
</script>

<div class="admin-page">
    <header>
        <h1>管理介面</h1>

        <div class="connection-status">
            <div
                class="status-item"
                class:connected={$connectionState.livekit === "connected"}
            >
                視訊串流:
                {#if $connectionState.livekit === "connected"}
                    已連線
                {:else if $connectionState.livekit === "connecting"}
                    連線中...
                {:else if $connectionState.livekit === "error"}
                    錯誤
                {:else}
                    未連線
                {/if}
            </div>

            <div
                class="status-item"
                class:connected={$connectionState.websocket === "connected"}
            >
                分數資料:
                {#if $connectionState.websocket === "connected"}
                    已連線
                {:else if $connectionState.websocket === "connecting"}
                    連線中...
                {:else if $connectionState.websocket === "error"}
                    錯誤
                {:else}
                    未連線
                {/if}
            </div>
        </div>

        <div class="mode-control">
            <button onclick={toggleMode}>
                切換至{$mode === "semi" ? "決賽" : "準決賽"}模式
            </button>
        </div>
    </header>

    <div class="content">
        <!-- Semi-finals mode -->
        {#if $mode === "semi"}
            <div class="semi-mode">
                <!-- Game 1 -->
                <div class="game-container">
                    <h2>準決賽 Game 1</h2>
                    <div class="score-display">
                        {#if $scores.scores.game1}
                            {#each Object.entries($scores.scores.game1) as [className, score]}
                                <div class="team-score">
                                    <span class="team-name">{className}</span>
                                    <span class="score">{score}</span>
                                </div>
                            {/each}
                        {:else}
                            <p>等待分數資料...</p>
                        {/if}
                    </div>

                    <div class="video-container">
                        {#if game1Streams.length > 0}
                            {#each game1Streams as stream (stream.participant.sid)}
                                <div class="video-wrapper">
                                    <video
                                        id={`video-${stream.participant.sid}`}
                                        autoplay
                                        playsinline
                                        muted
                                    ></video>
                                    <div class="video-label">Game 1</div>
                                </div>
                                
                                {#key stream.participant.sid}
                                    {@const attachVideo = () => {
                                        setTimeout(() => {
                                            const videoEl = document.getElementById(
                                                `video-${stream.participant.sid}`
                                            ) as HTMLVideoElement;
                                            if (videoEl && stream.videoPublication?.track) {
                                                console.log(`Attaching Game 1 video track for ${stream.participant.sid}`);
                                                stream.videoPublication.track.attach(videoEl);
                                            } else {
                                                console.warn(`Cannot attach Game 1 video: element or track missing for ${stream.participant.sid}`);
                                            }
                                        }, 100);
                                    }}
                                    {attachVideo()}
                                {/key}
                            {/each}
                        {:else}
                            <div class="placeholder">等待 Game 1 視訊...</div>
                        {/if}
                    </div>
                </div>

                <!-- Game 2 -->
                <div class="game-container">
                    <h2>準決賽 Game 2</h2>
                    <div class="score-display">
                        {#if $scores.scores.game2}
                            {#each Object.entries($scores.scores.game2) as [className, score]}
                                <div class="team-score">
                                    <span class="team-name">{className}</span>
                                    <span class="score">{score}</span>
                                </div>
                            {/each}
                        {:else}
                            <p>等待分數資料...</p>
                        {/if}
                    </div>

                    <div class="video-container">
                        {#if game2Streams.length > 0}
                            {#each game2Streams as stream (stream.participant.sid)}
                                <div class="video-wrapper">
                                    <video
                                        id={`video-${stream.participant.sid}`}
                                        autoplay
                                        playsinline
                                        muted
                                    ></video>
                                    <div class="video-label">Game 2</div>
                                </div>

                                {#key stream.participant.sid}
                                    {@const attachVideo = () => {
                                        setTimeout(() => {
                                            const videoEl = document.getElementById(
                                                `video-${stream.participant.sid}`
                                            ) as HTMLVideoElement;
                                            if (videoEl && stream.videoPublication?.track) {
                                                console.log(`Attaching Game 2 video track for ${stream.participant.sid}`);
                                                stream.videoPublication.track.attach(videoEl);
                                            } else {
                                                console.warn(`Cannot attach Game 2 video: element or track missing for ${stream.participant.sid}`);
                                            }
                                        }, 100);
                                    }}
                                    {attachVideo()}
                                {/key}
                            {/each}
                        {:else}
                            <div class="placeholder">等待 Game 2 視訊...</div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Finals mode -->
        {:else}
            <div class="final-mode">
                <h2>決賽</h2>
                <div class="score-display">
                    {#if $scores.scores.final}
                        {#each Object.entries($scores.scores.final) as [className, score]}
                            <div class="team-score">
                                <span class="team-name">{className}</span>
                                <span class="score">{score}</span>
                            </div>
                        {/each}
                    {:else}
                        <p>等待分數資料...</p>
                    {/if}
                </div>

                <div class="angles-container">
                    {#if angleStreams.length > 0}
                        {#each angleStreams as stream (stream.participant.sid)}
                            <div
                                class="angle-preview"
                                class:selected={$selectedSource ===
                                    stream.participant.sid}
                            >
                                <video
                                    id={`video-${stream.participant.sid}`}
                                    autoplay
                                    playsinline
                                    muted
                                ></video>
                                <div class="angle-controls">
                                    <div class="angle-label">
                                        {stream.angle || "Unknown"}
                                    </div>
                                    <button
                                        class="select-btn"
                                        class:active={$selectedSource ===
                                            stream.participant.sid}
                                        onclick={() =>
                                            switchSource(
                                                stream.participant.sid,
                                            )}
                                    >
                                        {$selectedSource ===
                                        stream.participant.sid
                                            ? "目前選中"
                                            : "選擇此視角"}
                                    </button>
                                </div>

                                {#key stream.participant.sid}
                                    {@const attachVideo = () => {
                                        setTimeout(() => {
                                            const videoEl = document.getElementById(
                                                `video-${stream.participant.sid}`
                                            ) as HTMLVideoElement;
                                            if (videoEl && stream.videoPublication?.track) {
                                                console.log(`Attaching angle video track for ${stream.participant.sid}`);
                                                stream.videoPublication.track.attach(videoEl);
                                            } else {
                                                console.warn(`Cannot attach angle video: element or track missing for ${stream.participant.sid}`);
                                            }
                                        }, 100);
                                    }}
                                    {attachVideo()}
                                {/key}
                            </div>
                        {/each}
                    {:else}
                        <div class="placeholder">等待決賽視訊...</div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .admin-page {
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100%;
        background-color: #f0f0f0;
        overflow: hidden;
    }

    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background-color: #333;
        color: white;
    }

    h1 {
        margin: 0;
        font-size: 1.2rem;
    }

    h2 {
        margin: 0 0 1rem 0;
        font-size: 1.1rem;
    }

    .connection-status {
        display: flex;
        gap: 1rem;
    }

    .status-item {
        padding: 0.25rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.8rem;
        background-color: #ccc;
    }

    .status-item.connected {
        background-color: #4caf50;
        color: white;
    }

    .mode-control button {
        padding: 0.5rem 1rem;
        background-color: #0066cc;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .content {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
    }

    .semi-mode {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .game-container {
        background-color: white;
        border-radius: 8px;
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .score-display {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-bottom: 1rem;
        background-color: #f8f8f8;
        padding: 0.5rem;
        border-radius: 4px;
    }

    .team-score {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .team-name {
        font-weight: bold;
    }

    .score {
        font-size: 1.5rem;
        font-weight: bold;
    }

    .video-container {
        aspect-ratio: 16/9;
        background-color: black;
        border-radius: 4px;
        overflow: hidden;
        position: relative;
    }

    .video-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
    }

    video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .video-label {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
    }

    .placeholder {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        background-color: #222;
        color: #ccc;
    }

    .final-mode {
        background-color: white;
        border-radius: 8px;
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .angles-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .angle-preview {
        border-radius: 4px;
        overflow: hidden;
        position: relative;
        aspect-ratio: 9/16; /* Vertical video ratio */
        border: 3px solid transparent;
        transition: border-color 0.3s;
    }

    .angle-preview.selected {
        border-color: #0066cc;
    }

    .angle-controls {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 0.5rem;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .angle-label {
        font-size: 0.9rem;
        font-weight: bold;
    }

    .select-btn {
        padding: 0.25rem 0.5rem;
        background-color: #0066cc;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 0.8rem;
        cursor: pointer;
    }

    .select-btn.active {
        background-color: #4caf50;
    }

    .select-btn:hover {
        background-color: #005bb5;
    }
</style>
