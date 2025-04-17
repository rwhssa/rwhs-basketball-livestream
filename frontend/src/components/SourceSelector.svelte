<script lang="ts">
  import type { StreamInfo } from '../stores/streams';
  import { selectedSource } from '../stores/streams';
  
  export let streams: StreamInfo[] = [];
  export let onSourceSelect: ((participantSid: string) => void) | null = null;
  
  function selectSource(participantSid: string) {
    $selectedSource = participantSid;
    
    if (onSourceSelect) {
      onSourceSelect(participantSid);
    }
  }
</script>

<div class="source-selector">
  <h3>選擇視角</h3>
  
  <div class="selector-buttons">
    {#if streams.length > 0}
      {#each streams as stream}
        <button 
          class="source-button"
          class:active={$selectedSource === stream.participant.sid}
          on:click={() => selectSource(stream.participant.sid)}
        >
          {stream.angle || '視角'} {stream.participant.identity.split('-').pop()}
        </button>
      {/each}
    {:else}
      <div class="empty-state">無可用視角</div>
    {/if}
  </div>
</div>

<style>
  .source-selector {
    padding: 1rem;
    background-color: #f5f5f5;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 0.75rem;
    font-size: 1rem;
  }
  
  .selector-buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  
  .source-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background-color: #ddd;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .source-button:hover {
    background-color: #ccc;
  }
  
  .source-button.active {
    background-color: #4caf50;
    color: white;
  }
  
  .empty-state {
    font-style: italic;
    color: #777;
  }
</style>