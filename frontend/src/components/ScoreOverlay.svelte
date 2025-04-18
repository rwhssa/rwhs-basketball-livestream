<script lang="ts">
  import { formatClassName } from '../lib/utils';
  
  export let scores: Record<string, string> = {};
  export let variant: 'semi' | 'final' = 'semi';

  // Debug function to check what's in the scores object
  function debugScoreEntries(): void {
    console.log(`ScoreOverlay received scores:`, scores);
    console.log(`Keys: ${Object.keys(scores).join(', ')}`);
    console.log(`Entries: ${JSON.stringify(Object.entries(scores))}`);
  }
  $: debugScoreEntries();
</script>

<div class="score-overlay" class:final={variant === 'final'}>
  {#if Object.keys(scores).length > 0}
    {#each Object.entries(scores) as [className, score], i}
      <div class="team-score">
        <span class="team-name">{formatClassName(className)}</span>
        <span class="score">{score}</span>
      </div>
      {#if i === 0 && Object.keys(scores).length > 1}
        <div class="score-divider">:</div>
      {/if}
    {/each}
  {:else}
    <div class="pending">等待分數資料...</div>
  {/if}
</div>

<style>
  .score-overlay {
    background-color: rgba(0, 0, 0, 0.7);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
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
  
  .pending {
    font-style: italic;
    font-size: 0.9rem;
  }
</style>