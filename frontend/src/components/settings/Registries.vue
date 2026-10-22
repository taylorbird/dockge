<template>
    <div class="my-4">
        <p class="text-muted">{{ $t("registriesDescription") }}</p>

        <!-- Server picker, only when more than one agent is connected -->
        <div v-if="$root.agentCount > 1" class="mb-4">
            <label for="registry-endpoint" class="form-label">{{ $t("registryServer") }}</label>
            <select id="registry-endpoint" v-model="endpoint" class="form-select">
                <option v-for="(agent, key) in $root.agentList" :key="key" :value="key">
                    {{ agentLabel(key) }}
                </option>
            </select>
        </div>

        <h5 class="my-4 settings-subheading">{{ $t("registryLoggedIn") }}</h5>

        <div v-if="loading" class="text-muted mb-4">…</div>
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

export default {
    name: "Registries",

    data() {
        return {
            // Key into $root.agentList ("" = local agent)
            endpoint: "",
            logins: [],
            loading: false,
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
            this.loading = true;
            this.$root.emitAgent(this.endpoint, "getRegistryLogins", (res) => {
                this.loading = false;
                if (res.ok) {
                    this.logins = res.registryLogins;
                } else {
                    this.logins = [];
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
