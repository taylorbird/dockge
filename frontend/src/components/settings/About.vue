<template>
    <div class="d-flex justify-content-center align-items-center">
        <div class="logo d-flex flex-column justify-content-center align-items-center">
            <object class="my-4" width="200" height="200" data="/icon.svg" />
            <div class="fs-4 fw-bold">Dockge</div>
            <div>{{ $t("Version") }}: {{ $root.info.version }}</div>
            <div v-if="$root.info.baseVersion" class="frontend-version">{{ $t("Based on Dockge") }}: {{ $root.info.baseVersion }}</div>
            <div class="frontend-version">{{ $t("Frontend Version") }}: {{ $root.frontendVersion }}</div>

            <div v-if="!$root.isFrontendBackendVersionMatched" class="alert alert-warning mt-4" role="alert">
                ⚠️ {{ $t("Frontend Version do not match backend version!") }}
            </div>

            <div v-if="hasUpstreamUpdate" class="alert alert-info mt-4" role="alert">
                {{ $t("upstreamUpdateAvailable") }}: {{ $root.info.latestVersion }}
                <div><a href="https://github.com/louislam/dockge/releases" target="_blank" rel="noopener">{{ $t("updateMainDockge") }}</a></div>
            </div>

            <div class="my-3 update-link"><a href="https://github.com/taylorbird/dockge/releases" target="_blank" rel="noopener">{{ $t("Check Update On GitHub") }}</a></div>

            <div class="mt-1">
                <div class="form-check">
                    <label><input v-model="settings.checkUpdate" type="checkbox" @change="saveSettings()" /> {{ $t("Show update if available") }}</label>
                </div>

                <div class="form-check">
                    <label><input v-model="settings.checkBeta" type="checkbox" :disabled="!settings.checkUpdate" @change="saveSettings()" /> {{ $t("Also check beta release") }}</label>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { compareVersions } from "compare-versions";

export default {
    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },

        // Whether upstream Dockge has a newer release than the version this fork is based on.
        hasUpstreamUpdate() {
            const info = this.$root.info;
            if (info.latestVersion && info.baseVersion) {
                return compareVersions(info.latestVersion, info.baseVersion) >= 1;
            }
            return false;
        },
    },

    watch: {

    }
};
</script>

<style lang="scss" scoped>
.logo {
    margin: 4em 1em;
}

.update-link {
    font-size: 0.8em;
}

.frontend-version {
    font-size: 0.9em;
    color: #cccccc;

    .dark & {
        color: #333333;
    }
}

</style>
