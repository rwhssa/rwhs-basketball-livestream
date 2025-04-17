<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "./stores/page";
    import Camera from "./routes/Camera.svelte";
    import Admin from "./routes/Admin.svelte";
    import Output from "./routes/Output.svelte";

    // Parse current URL to determine which page to load
    onMount(() => {
        const path = window.location.pathname;

        if (path.includes("camera")) {
            $page = "camera";
        } else if (path.includes("admin")) {
            $page = "admin";
        } else if (path.includes("output")) {
            $page = "output";
        } else {
            // Default to home/landing page
            $page = "home";
        }
    });
</script>

<main>
    {#if $page === "camera"}
        <Camera />
    {:else if $page === "admin"}
        <Admin />
    {:else if $page === "output"}
        <Output />
    {:else}
        <div class="landing">
            <h1>高中籃球賽事直播系統</h1>
            <nav>
                <a href="/camera">手機鏡頭</a>
                <a href="/admin">管理介面</a>
                <a href="/output">輸出畫面</a>
            </nav>
        </div>
    {/if}
</main>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans,
            Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    }

    main {
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
    }

    .landing {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        text-align: center;
    }

    nav {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 2rem;
    }

    a {
        display: inline-block;
        padding: 1rem 2rem;
        background-color: #0066cc;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
        min-width: 200px;
    }

    a:hover {
        background-color: #0052a3;
    }
</style>
