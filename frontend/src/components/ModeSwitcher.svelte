<script lang="ts">
  import { mode, type SystemMode } from '../stores/mode';
  
  export let onSwitch: ((newMode: SystemMode) => void) | null = null;
  
  function handleSwitch() {
    const newMode = $mode === 'semi' ? 'final' : 'semi';
    $mode = newMode;
    
    if (onSwitch) {
      onSwitch(newMode);
    }
  }
</script>

<div class="mode-switcher">
  <div class="mode-indicator">
    目前模式: <span class="mode-name">{$mode === 'semi' ? '準決賽' : '決賽'}</span>
  </div>
  
  <button class="switch-button" on:click={handleSwitch}>
    切換至{$mode === 'semi' ? '決賽' : '準決賽'}模式
  </button>
</div>

<style>
  .mode-switcher {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }
  
  .mode-indicator {
    font-size: 0.9rem;
  }
  
  .mode-name {
    font-weight: bold;
  }
  
  .switch-button {
    padding: 0.5rem 1rem;
    background-color: #0066cc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
  
  .switch-button:hover {
    background-color: #0052a3;
  }
</style>