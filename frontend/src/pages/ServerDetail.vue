<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-2">{{ displayName }}</h1>

            <div class="mb-4">
                <span v-if="status === 'online'" class="badge bg-primary me-2">{{ $t("agentOnline") }}</span>
                <span v-else class="badge bg-danger me-2">{{ $t("agentOffline") }}</span>
                <span v-if="version" class="badge me-2" :class="outdated ? 'bg-warning text-dark' : 'bg-secondary'">
                    {{ $t("Version") }} {{ version }}
                </span>
                <span v-if="agent && agent.url" class="agent-url">{{ agent.url }}</span>
            </div>
            <div v-if="outdated" class="alert alert-warning mb-4">
                {{ $t("outdatedServerMsg", [ version, $root.fleetLatestVersion ]) }}
            </div>

            <!-- Stack counts -->
            <div class="stat-grid mb-4">
                <div class="shadow-box stat-tile">
                    <div class="stat-label">{{ $t("active") }}</div>
                    <div class="stat-value">{{ activeNum }}</div>
                </div>
                <div class="shadow-box stat-tile">
                    <div class="stat-label">{{ $t("exited") }}</div>
                    <div class="stat-value">{{ exitedNum }}</div>
                </div>
                <div class="shadow-box stat-tile">
                    <div class="stat-label">{{ $t("inactive") }}</div>
                    <div class="stat-value">{{ inactiveNum }}</div>
                </div>
                <div v-if="status === 'online'" class="shadow-box stat-tile">
                    <div class="stat-label">{{ $t("containers") }}</div>
                    <div class="stat-value">{{ containerCount }}</div>
                </div>
            </div>

            <!-- Live resource charts -->
            <div v-if="status === 'online'" class="chart-grid mb-4">
                <div class="shadow-box stat-tile">
                    <div class="stat-head">
                        <span class="stat-label">{{ $t("CPU") }}</span>
                        <span class="stat-value">{{ cpuNow }}</span>
                    </div>
                    <SparklineChart :points="cpuHistory" :format="formatCpu" />
                </div>
                <div class="shadow-box stat-tile">
                    <div class="stat-head">
                        <span class="stat-label">{{ $t("memory") }}</span>
                        <span class="stat-value">{{ memNow }}</span>
                    </div>
                    <SparklineChart :points="memHistory" :format="formatBytes" />
                </div>
            </div>
            <p v-else class="offline-note mb-4">{{ $t("serverOfflineStatsMsg") }}</p>

            <!-- Stacks -->
            <h2 class="mb-3">{{ $t("stacksOnServer") }}</h2>
            <div class="shadow-box big-padding mb-4">
                <StackListItem
                    v-for="(stack, index) in stacks"
                    :key="index" :stack="stack"
                />
                <p v-if="stacks.length === 0" class="mb-0">{{ $t("noStacksOnServer") }}</p>
            </div>

            <!-- Manage (remote agents only) -->
            <template v-if="endpoint !== 'current'">
                <h2 class="mb-3">{{ $t("manageServer") }}</h2>
                <div class="shadow-box big-padding mb-4">
                    <form class="mb-4" @submit.prevent="updateName">
                        <label for="updatedName" class="form-label">{{ $t("Friendly Name") }}</label>
                        <div class="update-name">
                            <input id="updatedName" v-model="updatedName" type="text" class="form-control" />
                            <button type="submit" class="btn btn-normal">{{ $t("Update Name") }}</button>
                        </div>
                    </form>

                    <button class="btn btn-danger" @click="showRemoveDialog = true">{{ $t("removeAgent") }}</button>

                    <BModal v-model="showRemoveDialog" :okTitle="$t('removeAgent')" okVariant="danger" @ok="removeAgent">
                        <p>{{ agent?.url }}</p>
                        {{ $t("removeAgentMsg") }}
                    </BModal>
                </div>
            </template>
        </div>
    </transition>
</template>

<script>
import StackListItem from "../components/StackListItem.vue";
import SparklineChart from "../components/SparklineChart.vue";
import { statusNameShort, RUNNING, EXITED } from "../../../common/util-common";

// Rolling buffer: 120 samples at 5s = last 10 minutes
const MAX_SAMPLES = 120;
const POLL_INTERVAL = 5000;

let statsTimeout = null;

export default {
    components: {
        StackListItem,
        SparklineChart,
    },
    data() {
        return {
            updatedName: "",
            showRemoveDialog: false,
            dockerStats: {},
            cpuHistory: [],
            memHistory: [],
            stopStats: false,
        };
    },
    computed: {
        endpoint() {
            return decodeURIComponent(this.$route.params.endpoint);
        },

        /** Key into $root.agentList / agentStatusList ("" = local agent) */
        agentKey() {
            return this.endpoint === "current" ? "" : this.endpoint;
        },

        agent() {
            return this.$root.agentList[this.agentKey];
        },

        status() {
            return this.$root.agentStatusList[this.agentKey] || "offline";
        },

        version() {
            return this.$root.agentVersion(this.agentKey);
        },

        outdated() {
            return this.$root.isAgentOutdated(this.agentKey);
        },

        displayName() {
            if (this.endpoint === "current") {
                return this.$t("currentEndpoint");
            }
            return this.$root.endpointDisplayFunction(this.endpoint) || this.endpoint;
        },

        stacks() {
            return Object.values(this.$root.completeStackList)
                .filter(stack => (stack.endpoint || "current") === this.endpoint)
                .sort((s1, s2) => {
                    if (s1.status !== s2.status) {
                        if (s1.status === RUNNING) {
                            return -1;
                        } else if (s2.status === RUNNING) {
                            return 1;
                        } else if (s1.status === EXITED) {
                            return -1;
                        } else if (s2.status === EXITED) {
                            return 1;
                        }
                    }
                    return s1.name.localeCompare(s2.name);
                });
        },

        activeNum() {
            return this.stacks.filter(stack => statusNameShort(stack.status) === "active").length;
        },
        exitedNum() {
            return this.stacks.filter(stack => statusNameShort(stack.status) === "exited").length;
        },
        inactiveNum() {
            return this.stacks.filter(stack => statusNameShort(stack.status) === "inactive").length;
        },

        containerCount() {
            return Object.keys(this.dockerStats).length;
        },

        cpuNow() {
            const last = this.cpuHistory[this.cpuHistory.length - 1];
            return last ? this.formatCpu(last.v) : "–";
        },

        memNow() {
            const last = this.memHistory[this.memHistory.length - 1];
            return last ? this.formatBytes(last.v) : "–";
        },
    },
    watch: {
        agent: {
            handler() {
                this.updatedName = this.agent?.name || "";
            },
            immediate: true,
        },

        // Changing server: reset the live buffers and sample right away
        endpoint() {
            this.dockerStats = {};
            this.cpuHistory = [];
            this.memHistory = [];
            this.requestStats();
        },
    },
    mounted() {
        this.requestStats();
    },
    beforeUnmount() {
        this.stopStats = true;
        clearTimeout(statsTimeout);
    },
    methods: {
        requestStats() {
            clearTimeout(statsTimeout);

            if (this.status !== "online") {
                // Come back later in case the server comes online
                statsTimeout = setTimeout(() => this.requestStats(), POLL_INTERVAL);
                return;
            }

            this.$root.emitAgent(this.agentKey, "dockerStats", (res) => {
                if (res.ok) {
                    this.dockerStats = res.dockerStats;
                    this.addSample(res.dockerStats);
                }
                if (!this.stopStats) {
                    statsTimeout = setTimeout(() => this.requestStats(), POLL_INTERVAL);
                }
            });
        },

        addSample(dockerStats) {
            let cpu = 0;
            let memUsed = 0;

            for (const stat of Object.values(dockerStats)) {
                cpu += parseFloat(stat.CPUPerc) || 0;
                const memParts = (stat.MemUsage || "").split(" / ");
                memUsed += this.parseSize(memParts[0]);
            }

            const t = Date.now();
            this.cpuHistory.push({ t,
                v: cpu });
            this.memHistory.push({ t,
                v: memUsed });

            if (this.cpuHistory.length > MAX_SAMPLES) {
                this.cpuHistory.shift();
                this.memHistory.shift();
            }
        },

        /**
         * Parse a docker stats size string (e.g. "412.3MiB") into bytes
         * @param {string} size Size string from docker stats
         * @returns {number} Size in bytes
         */
        parseSize(size) {
            const match = /^([\d.]+)\s*([A-Za-z]+)$/.exec((size || "").trim());
            if (!match) {
                return 0;
            }
            const units = {
                "B": 1,
                "kB": 1000,
                "MB": 1000 ** 2,
                "GB": 1000 ** 3,
                "TB": 1000 ** 4,
                "KiB": 1024,
                "MiB": 1024 ** 2,
                "GiB": 1024 ** 3,
                "TiB": 1024 ** 4,
            };
            return parseFloat(match[1]) * (units[match[2]] || 1);
        },

        formatCpu(value) {
            return value.toFixed(1) + "%";
        },

        formatBytes(bytes) {
            if (bytes >= 1024 ** 3) {
                return (bytes / 1024 ** 3).toFixed(2) + " GiB";
            }
            if (bytes >= 1024 ** 2) {
                return (bytes / 1024 ** 2).toFixed(1) + " MiB";
            }
            if (bytes >= 1024) {
                return (bytes / 1024).toFixed(0) + " KiB";
            }
            return bytes.toFixed(0) + " B";
        },

        updateName() {
            this.$root.getSocket().emit("updateAgent", this.agent.url, this.updatedName, (res) => {
                this.$root.toastRes(res);
            });
        },

        removeAgent() {
            const url = this.agent.url;
            this.$root.getSocket().emit("removeAgent", url, (res) => {
                if (res.ok) {
                    this.$root.toastRes(res);

                    let urlObj = new URL(url);
                    let endpoint = urlObj.host;

                    // Remove the stack list and status list of the removed agent
                    delete this.$root.allAgentStackList[endpoint];

                    this.$router.push("/");
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars";

.agent-url {
    color: $dark-font-color3;
    font-size: 14px;
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
}

.chart-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 15px;
}

.stat-tile {
    padding: 15px 20px;
}

.stat-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: $dark-font-color3;
}

.stat-value {
    font-size: 26px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
}

.stat-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;

    .stat-value {
        font-size: 20px;
    }
}

.offline-note {
    color: $dark-font-color3;
    font-size: 14px;
}

.update-name {
    display: flex;
    gap: 10px;
    max-width: 400px;

    input {
        flex: 1;
    }
}
</style>
