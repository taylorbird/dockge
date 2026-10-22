<template>
    <div class="my-4">
        <p>{{ $t("registriesDescription") }}</p>

        <!-- Server picker, only when more than one agent is connected -->
        <div v-if="$root.agentCount > 1" class="mb-3">
            <label for="registry-endpoint" class="form-label">{{ $t("registryServer") }}</label>
            <select id="registry-endpoint" v-model="endpoint" class="form-select">
                <option v-for="(agent, key) in $root.agentList" :key="key" :value="key">
                    {{ agentLabel(key) }}
                </option>
            </select>
        </div>

        <!-- Always say which server the logins below belong to -->
        <div class="alert alert-info mb-4">
            {{ $t("registryManaging", [ agentLabel(endpoint) ]) }}
        </div>

        <h5 class="my-4 settings-subheading">{{ $t("registryLoggedIn") }}</h5>

        <div v-if="loading" class="text-muted mb-4">…</div>
        <div v-else-if="notSupported" class="alert alert-warning mb-4">{{ $t("registryNotSupported") }}</div>
        <p v-else-if="logins.length === 0" class="text-muted mb-4">{{ $t("registryNone") }}</p>
        <ul v-else class="list-group mb-4">
            <li v-for="entry in logins" :key="entry.server" class="list-group-item d-flex align-items-center">
                <div class="flex-grow-1">
                    <div><strong>{{ registryLabel(entry.server) }}</strong></div>
                    <div v-if="entry.username" class="text-muted small">{{ entry.username }}</div>
                </div>
                <button class="btn btn-sm btn-danger" :disabled="processing" @click="logout(entry.server)">
                    {{ $t("Logout") }}
                </button>
            </li>
        </ul>

        <h5 class="my-4 settings-subheading">{{ $t("registryAdd") }}</h5>
        <form autocomplete="off" @submit.prevent="login">
            <div class="mb-3">
                <label for="registry-server" class="form-label">{{ $t("registryAddress") }}</label>
                <input
                    id="registry-server"
                    v-model="form.server"
                    type="text"
                    class="form-control"
                    placeholder="ghcr.io"
                    autocomplete="off"
                />
                <div class="form-text">{{ $t("registryAddressHelp") }}</div>
            </div>

            <div class="mb-3">
                <label for="registry-username" class="form-label">{{ $t("Username") }}</label>
                <input
                    id="registry-username"
                    v-model="form.username"
                    type="text"
                    class="form-control"
                    autocomplete="off"
                    required
                />
            </div>

            <div class="mb-3">
                <label for="registry-password" class="form-label">{{ $t("registryPassword") }}</label>
                <input
                    id="registry-password"
                    v-model="form.password"
                    type="password"
                    class="form-control"
                    autocomplete="new-password"
                    required
                />
            </div>

            <button class="btn btn-primary" type="submit" :disabled="processing">
                {{ $t("Login") }}
            </button>
        </form>
    </div>
</template>

<script>
const DOCKER_HUB_KEY = "https://index.docker.io/v1/";
const LOAD_TIMEOUT_MS = 10 * 1000;

export default {
    name: "Registries",

    data() {
        return {
            // Key into $root.agentList ("" = local agent)
            endpoint: "",
            logins: [],
            loading: false,
            notSupported: false,
            requestID: 0,
            timeout: null,
            processing: false,
            form: {
                server: "",
                username: "",
                password: "",
            },
        };
    },

    watch: {
        endpoint() {
            this.loadLogins();
        },
    },

    mounted() {
        this.loadLogins();
    },

    beforeUnmount() {
        clearTimeout(this.timeout);
    },

    methods: {
        agentLabel(key) {
            if (key === "") {
                return this.$t("currentEndpoint");
            }
            return this.$root.endpointDisplayFunction(key) || key;
        },

        registryLabel(server) {
            return server === DOCKER_HUB_KEY ? "Docker Hub" : server;
        },

        loadLogins() {
            // Only the latest request may update the list (switching servers quickly)
            const requestID = ++this.requestID;
            this.loading = true;
            this.notSupported = false;
            this.logins = [];

            // Agents on a Dockge version without registry support never answer
            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                if (requestID === this.requestID) {
                    this.loading = false;
                    this.notSupported = true;
                }
            }, LOAD_TIMEOUT_MS);

            this.$root.emitAgent(this.endpoint, "getRegistryLogins", (res) => {
                if (requestID !== this.requestID) {
                    return;
                }
                clearTimeout(this.timeout);
                this.loading = false;
                if (res.ok) {
                    this.logins = res.registryLogins;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        login() {
            this.processing = true;
            this.$root.emitAgent(this.endpoint, "registryLogin", this.form.server, this.form.username, this.form.password, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.form = {
                        server: "",
                        username: "",
                        password: "",
                    };
                    this.loadLogins();
                }
            });
        },

        logout(server) {
            this.processing = true;
            this.$root.emitAgent(this.endpoint, "registryLogout", server, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                this.loadLogins();
            });
        },
    },
};
</script>
