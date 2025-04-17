<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    Room, 
    LocalParticipant, 
    RoomEvent, 
    createLocalTracks, 
    Track 
  } from 'livekit-client';
  import { connectionState } from '../stores/connection';
  import { mode } from '../stores/mode';

  // Local state
  let localRoom: Room | null = $state(null);
  let localParticipant: LocalParticipant | null = $state(null);
  let videoElement: HTMLVideoElement;
  let cameraReady = $state(false);
  let publishingError = $state('');
  let phase: 'semi' | 'final' = $state($mode);
  let wsConnection: WebSocket | null = $state(null);
  let metadata = $state({
    game: 'game1',    // For semi-finals: game1 or game2
    angle: 'main'     // For finals: angle1 or angle2
  });

  // Update local metadata based on phase
  $effect(() => {
    // When mode store changes, update local phase
    if ($mode !== phase) {
      phase = $mode;
      
      // Update metadata values when phase changes
      if (phase === 'semi' && !['game1', 'game2'].includes(metadata.game)) {
        metadata.game = 'game1';
      } else if (phase === 'final' && !['angle1', 'angle2'].includes(metadata.angle)) {
        metadata.angle = 'angle1';
      }
      
      updateMetadata();
    }
  });

  let metadataOptions = $derived(
    phase === 'semi' ? ['game1', 'game2'] : ['angle1', 'angle2']
  );
  
  let metadataLabel = $derived(phase === 'semi' ? '比賽' : '視角');

  // WebSocket Connection
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
          if (data.phase && data.phase !== phase) {
            console.log("Mode changed via WebSocket:", data.phase);
            phase = data.phase; // Update local phase
            $mode = data.phase; // Update mode store
            updateMetadata(); // Update metadata when phase changes
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

  // Connect to LiveKit
  async function connectLiveKit() {
    try {
      $connectionState.livekit = 'connecting';
      const currentPhase = phase; // Use stable value within async function
      
      // Get token from backend
      const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const response = await fetch(
        `${apiBaseUrl}/api/token?type=camera&phase=${currentPhase}`,
        { method: 'GET' }
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
      
      // Create LocalTracks (camera and microphone)
      const tracks = await createLocalTracks({
        audio: true,
        video: true
      });
      
      // Create and connect room
      const room = new Room();
      localRoom = room; // Assign to state
      
      try {
        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
        console.log(`Connecting to LiveKit at ${livekitUrl}`);
        await room.connect(livekitUrl, token);
        console.log("LiveKit connected to room:", roomName);
        $connectionState.livekit = 'connected';
        
        localParticipant = room.localParticipant;
        
        // Ensure localParticipant is defined
        if (localParticipant) {
          await localParticipant.setMetadata(JSON.stringify({
            phase: currentPhase,
            ...metadata
          }));
          
          // Publish video and audio tracks
          await Promise.all(tracks.map(track => localParticipant!.publishTrack(track)));
          
          // Find the video track
          const videoTrack = tracks.find(track => track.kind === 'video');
          if (videoTrack) {
            // Create video element if it doesn't exist
            if (!videoElement) {
              videoElement = document.createElement('video');
              videoElement.autoplay = true;
              videoElement.muted = true;
              videoElement.playsInline = true;
              
              // Add to container
              const container = document.querySelector('.camera-container');
              if (container) {
                container.appendChild(videoElement);
              }
            }
            
            // Attach video track
            videoTrack.attach(videoElement);
            cameraReady = true;
          }
        }
        
        // Set up event listeners
        room.on(RoomEvent.Disconnected, () => {
          $connectionState.livekit = 'disconnected';
        });
        
        room.on(RoomEvent.ConnectionStateChanged, () => {
          if (room.state === 'disconnected') {
            $connectionState.livekit = 'disconnected';
          } else if (room.state === 'connected') {
            $connectionState.livekit = 'connected';
          }
        });
      } catch (connectErr: any) {
        console.error("LiveKit room.connect error:", connectErr);
        
        // Check for specific API key error
        if (connectErr.message && connectErr.message.includes("invalid API key")) {
          $connectionState.errorMessage = "LiveKit API key is invalid or expired. Please contact the administrator.";
          throw new Error("LiveKit connection failed: Invalid API key. The API key may be expired or misconfigured.");
        }
        
        throw connectErr; // Re-throw to be caught by outer try block
      }
      
    } catch (err) {
      console.error('LiveKit connection error:', err);
      publishingError = err instanceof Error ? err.message : 'Unknown error';
      $connectionState.livekit = 'error';
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

  // Update metadata when selection changes
  async function updateMetadata() {
    if (!localParticipant) return;
    
    try {
      await localParticipant.setMetadata(JSON.stringify({
        phase,
        ...metadata
      }));
      console.log('Metadata updated:', { phase, ...metadata });
    } catch (err) {
      console.error('Error updating metadata:', err);
    }
  }

  // Handle phase change
  function handlePhaseChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    phase = target.value as 'semi' | 'final';
    $mode = phase; // Update the global mode store as well
    updateMetadata();
  }
  
  // Handle metadata change
  function handleMetadataChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    if (phase === 'semi') {
      metadata.game = target.value;
    } else {
      metadata.angle = target.value;
    }
    updateMetadata();
  }

  // Clean up on component destruction
  onDestroy(async () => {
    console.log("Camera component destroying");
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
    
    // Remove video element if it exists
    if (videoElement && videoElement.parentNode) {
      videoElement.parentNode.removeChild(videoElement);
    }
  });
  
  // Initialize when component mounts
  onMount(() => {
    console.log("Camera component mounted");
    connectWebSocket();
    connectLiveKit();
  });
</script>

<div class="camera-page">
  <header>
    <h1>手機攝影機</h1>
    <div class="connection-status" class:connected={$connectionState.livekit === 'connected'}>
      {#if $connectionState.livekit === 'connected'}
        已連線
      {:else if $connectionState.livekit === 'connecting'}
        連線中...
      {:else if $connectionState.livekit === 'error'}
        連線錯誤: {$connectionState.errorMessage}
      {:else}
        未連線
      {/if}
    </div>
  </header>
  
  <!-- Connection error display -->
  {#if $connectionState.livekit === "error"}
    <div class="error-overlay">
      <div class="error-message">
        <h3>連線錯誤</h3>
        <p>{$connectionState.errorMessage || "無法連線到視訊串流。"}</p>
        <button onclick={connectLiveKit}>重試連線</button>
      </div>
    </div>
  {/if}
  
  <div class="camera-container">
    {#if !cameraReady}
      <div class="loading">
        {#if publishingError}
          <p class="error">攝影機連線錯誤: {publishingError}</p>
          <button onclick={connectLiveKit}>重試</button>
        {:else}
          <p>正在連接攝影機...</p>
        {/if}
      </div>
    {/if}
  </div>
  
  <div class="controls">
    <div class="form-group">
      <label for="phase-select">階段:</label>
      <select id="phase-select" 
        value={phase}
        onchange={handlePhaseChange}
      >
        <option value="semi">準決賽</option>
        <option value="final">決賽</option>
      </select>
    </div>
    
    <div class="form-group">
      <label for="metadata-select">{metadataLabel}:</label>
      <select 
        id="metadata-select"
        onchange={handleMetadataChange}
        value={phase === 'semi' ? metadata.game : metadata.angle}
      >
        {#each metadataOptions as option}
          <option value={option}>
            {option === 'game1' ? '比賽 1' :
             option === 'game2' ? '比賽 2' :
             option === 'angle1' ? '視角 1' :
             option === 'angle2' ? '視角 2' : option}
          </option>
        {/each}
      </select>
    </div>
  </div>
</div>

<style>
  .camera-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background-color: #f0f0f0;
    position: relative; /* For error overlay positioning */
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
  
  .connection-status {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.8rem;
    background-color: #ccc;
  }
  
  .connection-status.connected {
    background-color: #4caf50;
    color: white;
  }
  
  .camera-container {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #000;
    overflow: hidden;
  }
  
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .loading {
    text-align: center;
    color: white;
  }
  
  .error {
    color: #ff5252;
  }
  
  .controls {
    padding: 1rem;
    background-color: #333;
    color: white;
    display: flex;
    justify-content: space-around;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    width: 45%;
  }
  
  select {
    padding: 0.5rem;
    font-size: 1rem;
    margin-top: 0.5rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: #0066cc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 1rem;
  }
  
  button:hover {
    background-color: #0052a3;
  }
  
  /* Error overlay styles */
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