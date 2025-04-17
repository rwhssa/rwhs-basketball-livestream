<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { RemoteTrackPublication } from 'livekit-client';
  import type { StreamInfo } from '../stores/streams';
  
  export let stream: StreamInfo;
  export let label: string | null = null;
  export let muted: boolean = false;
  
  let videoElement: HTMLVideoElement;
  let audioAttached = false;
  let videoAttached = false;
  
  // Attach video track when component mounts or when stream changes
  function attachTracks() {
    if (!videoElement) return;
    
    // Detach existing tracks first
    if (videoAttached && stream.videoPublication?.track) {
      stream.videoPublication.track.detach(videoElement);
      videoAttached = false;
    }
    
    if (audioAttached && stream.audioPublication?.track) {
      stream.audioPublication.track.detach(videoElement);
      audioAttached = false;
    }
    
    // Attach video track
    if (stream.videoPublication?.track) {
      stream.videoPublication.track.attach(videoElement);
      videoAttached = true;
    }
    
    // Attach audio track if not muted
    if (!muted && stream.audioPublication?.track) {
      stream.audioPublication.track.attach(videoElement);
      audioAttached = true;
    }
  }
  
  $: if (videoElement && stream) {
    attachTracks();
  }
  
  // Clean up when component is destroyed
  onDestroy(() => {
    if (videoElement) {
      if (videoAttached && stream?.videoPublication?.track) {
        stream.videoPublication.track.detach(videoElement);
      }
      
      if (audioAttached && stream?.audioPublication?.track) {
        stream.audioPublication.track.detach(videoElement);
      }
    }
  });
</script>

<div class="video-container">
  <video bind:this={videoElement} autoplay playsinline {muted}></video>
  {#if label}
    <div class="video-label">{label}</div>
  {/if}
  <slot></slot>
</div>

<style>
  .video-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #000;
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
</style>