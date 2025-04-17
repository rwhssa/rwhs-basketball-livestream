<script lang="ts">
  import { connectionState } from '../stores/connection';
  
  export let showLabel: boolean = true;
  export let compact: boolean = false;
</script>

<div class="connection-status" class:compact>
  <div class="status-item" class:connected={$connectionState.livekit === 'connected'}>
    {#if showLabel}
      <span class="label">視訊串流:</span> 
    {/if}
    
    <span class="status">
      {#if $connectionState.livekit === 'connected'}
        已連線
      {:else if $connectionState.livekit === 'connecting'}
        連線中...
      {:else if $connectionState.livekit === 'error'}
        錯誤
      {:else}
        未連線
      {/if}
    </span>
  </div>
  
  <div class="status-item" class:connected={$connectionState.websocket === 'connected'}>
    {#if showLabel}
      <span class="label">分數資料:</span> 
    {/if}
    
    <span class="status">
      {#if $connectionState.websocket === 'connected'}
        已連線
      {:else if $connectionState.websocket === 'connecting'}
        連線中...
      {:else if $connectionState.websocket === 'error'}
        錯誤
      {:else}
        未連線
      {/if}
    </span>
  </div>
  
  {#if $connectionState.livekit === 'error' || $connectionState.websocket === 'error'}
    <div class="error-message">
      {$connectionState.errorMessage || '連線發生錯誤'}
    </div>
  {/if}
</div>

<style>
  .connection-status {
    display: flex;
    gap: 1rem;
    font-size: 0.9rem;
  }
  
  .connection-status.compact {
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  
  .status-item {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    background-color: #ccc;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .status-item.connected {
    background-color: #4caf50;
    color: white;
  }
  
  .label {
    font-weight: bold;
  }
  
  .error-message {
    color: #f44336;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
  
  .compact .status-item {
    padding: 0.15rem 0.5rem;
  }
</style>