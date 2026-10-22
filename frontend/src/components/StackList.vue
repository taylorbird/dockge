<template>
    <div class="shadow-box mb-3" :style="boxStyle">
        <div class="list-header">
            <div class="header-top">
                <!-- TODO -->
                <button
                    v-if="false" class="btn btn-outline-normal ms-2" :class="{ 'active': selectMode }" type="button"
                    @click="selectMode = !selectMode"
                >
                    {{ $t("Select") }}
                </button>

                <div class="placeholder"></div>
                <div class="search-wrapper">
                    <a v-if="searchText == ''" class="search-icon">
                        <font-awesome-icon icon="search" />
                    </a>
                    <a v-if="searchText != ''" class="search-icon" style="cursor: pointer" @click="clearSearchText">
                        <font-awesome-icon icon="times" />
                    </a>
                    <form>
                        <input v-model="searchText" class="form-control search-input" autocomplete="off" />
                    </form>
                </div>
            </div>

            <!-- TODO -->
            <div v-if="false" class="header-filter">
                <!--<StackListFilter :filterState="filterState" @update-filter="updateFilter" />-->
            </div>

            <!-- TODO: Selection Controls -->
            <div v-if="selectMode && false" class="selection-controls px-2 pt-2">
                <input v-model="selectAll" class="form-check-input select-input" type="checkbox" />

                <button class="btn-outline-normal" @click="pauseDialog">
                    <font-awesome-icon icon="pause" size="sm" /> {{
                        $t("Pause") }}
                </button>
                <button class="btn-outline-normal" @click="resumeSelected">
                    <font-awesome-icon icon="play" size="sm" />
                    {{ $t("Resume") }}
                </button>

                <span v-if="selectedStackCount > 0">
                    {{ $t("selectedStackCount", [selectedStackCount]) }}
                </span>
            </div>
        </div>
        <div v-if="$root.agentCount > 1" class="server-list">
            <div class="server-list-title">{{ $t("servers") }}</div>
            <div
                v-for="server in serverRows" :key="server.endpoint"
                class="server-row" :class="{ active: selectedEndpoint === server.endpoint }"
                :title="$t('runningStacksTooltip', [ server.running, server.total ])"
                @click="toggleServerFilter(server.endpoint)"
            >
                <span class="status-dot" :class="server.status" :title="$t(server.status === 'online' ? 'agentOnline' : 'agentOffline')"></span>
                <span class="server-name">{{ server.name }}</span>
                <span
                    v-if="$root.isAgentOutdated(server.endpoint)" class="badge outdated-badge"
                    :title="$t('outdatedTooltip', [ $root.agentVersion(server.endpoint), $root.fleetLatestVersion ])"
                >{{ $t("outdated") }}</span>
                <span class="server-count">{{ server.running }}/{{ server.total }}</span>
            </div>
        </div>
        <div ref="stackList" class="stack-list" :class="{ scrollbar: scrollbar }">
            <div v-if="agentStackList[0] && agentStackList[0].stacks.length === 0" class="text-center mt-3">
                <router-link to="/compose">{{ $t("addFirstStackMsg") }}</router-link>
            </div>
            <div v-for="(agent, agentIndex) in agentStackList" :key="agentIndex" class="stack-list-inner">
                <div
                    v-if="$root.agentCount > 1" class="agent-select"
                    @click="closedAgents.set(agent.endpoint, !closedAgents.get(agent.endpoint))"
                >
                    <span class="me-1">
                        <font-awesome-icon v-show="closedAgents.get(agent.endpoint)" icon="chevron-circle-right" />
                        <font-awesome-icon v-show="!closedAgents.get(agent.endpoint)" icon="chevron-circle-down" />
                    </span>
                    <span class="status-dot me-2" :class="agentStatus(agent.endpoint)" :title="$t(agentStatus(agent.endpoint) === 'online' ? 'agentOnline' : 'agentOffline')"></span>
                    <span v-if="agent.endpoint === 'current'" class="agent-name">{{ $t("currentEndpoint") }}</span>
                    <span v-else class="agent-name">{{ $root.endpointDisplayFunction(agent.endpoint) || agent.endpoint }}</span>
                    <span class="stack-count" :title="$t('runningStacksTooltip', [ runningCount(agent), agent.stacks.length ])">
                        {{ runningCount(agent) }}/{{ agent.stacks.length }}
                    </span>
                </div>
                <StackListItem
                    v-for="(item, index) in agent.stacks"
                    v-show="$root.agentCount === 1 || !closedAgents.get(agent.endpoint)" :key="index" :stack="item" :isSelectMode="selectMode"
                    :isSelected="isSelected" :select="select" :deselect="deselect"
                />
            </div>
        </div>
    </div>

    <Confirm ref="confirmPause" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="pauseSelected">
        {{ $t("pauseStackMsg") }}
    </Confirm>
</template>

<script>
import Confirm from "../components/Confirm.vue";
import StackListItem from "../components/StackListItem.vue";
import { CREATED_FILE, CREATED_STACK, EXITED, RUNNING, UNKNOWN } from "../../../common/util-common";

export default {
    components: {
        Confirm,
        StackListItem,
    },
    props: {
        /** Should the scrollbar be shown */
        scrollbar: {
            type: Boolean,
        },
    },
    data() {
        return {
            searchText: "",
            selectMode: false,
            selectAll: false,
            disableSelectAllWatcher: false,
            selectedStacks: {},
            windowTop: 0,
            filterState: {
                status: null,
                active: null,
                tags: null,
            },
            closedAgents: new Map(),
            selectedEndpoint: null,
        };
    },
    computed: {
        /**
         * One row per connected agent for the server overview panel,
         * with unfiltered running/total stack counts.
         * @returns {Array} Server rows sorted with the local agent first
         */
        serverRows() {
            const allStacks = Object.values(this.$root.completeStackList);
            const rows = Object.keys(this.$root.agentList).map(endpoint => {
                const key = endpoint === "" ? "current" : endpoint;
                const stacks = allStacks.filter(stack => (stack.endpoint || "current") === key);
                return {
                    endpoint: key,
                    name: key === "current" ? this.$t("currentEndpoint") : (this.$root.endpointDisplayFunction(endpoint) || endpoint),
                    status: this.$root.agentStatusList[endpoint] || "offline",
                    running: stacks.filter(stack => stack.status === RUNNING).length,
                    total: stacks.length,
                };
            });

            return rows.sort((a, b) => {
                if (a.endpoint === "current" && b.endpoint !== "current") {
                    return -1;
                } else if (a.endpoint !== "current" && b.endpoint === "current") {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });
        },

        /**
         * Improve the sticky appearance of the list by increasing its
         * height as user scrolls down.
         * Not used on mobile.
         * @returns {object} Style for stack list
         */
        boxStyle() {
            if (window.innerWidth > 550) {
                return {
                    height: `calc(100vh - 160px + ${this.windowTop}px)`,
                };
            } else {
                return {
                    height: "calc(100vh - 160px)",
                };
            }

        },

        /**
         * Returns a sorted list of stacks based on the applied filters and search text.
         * @returns {Array} The sorted list of stacks.
         */
        agentStackList() {
            let result = Object.values(this.$root.completeStackList);

            result = result.filter(stack => {
                // filter by search text
                // finds stack name, tag name or tag value
                let searchTextMatch = true;
                if (this.searchText !== "") {
                    const loweredSearchText = this.searchText.toLowerCase();
                    searchTextMatch =
                        stack.name.toLowerCase().includes(loweredSearchText)
                        || stack.tags.find(tag => tag.name.toLowerCase().includes(loweredSearchText)
                            || tag.value?.toLowerCase().includes(loweredSearchText));
                }

                // filter by active
                let activeMatch = true;
                if (this.filterState.active != null && this.filterState.active.length > 0) {
                    activeMatch = this.filterState.active.includes(stack.active);
                }

                // filter by tags
                let tagsMatch = true;
                if (this.filterState.tags != null && this.filterState.tags.length > 0) {
                    tagsMatch = stack.tags.map(tag => tag.tag_id) // convert to array of tag IDs
                        .filter(stackTagId => this.filterState.tags.includes(stackTagId)) // perform Array Intersaction between filter and stack's tags
                        .length > 0;
                }

                return searchTextMatch && activeMatch && tagsMatch;
            });

            result.sort((m1, m2) => {

                // sort by managed by dockge
                if (m1.isManagedByDockge && !m2.isManagedByDockge) {
                    return -1;
                } else if (!m1.isManagedByDockge && m2.isManagedByDockge) {
                    return 1;
                }

                // sort by status
                if (m1.status !== m2.status) {
                    if (m2.status === RUNNING) {
                        return 1;
                    } else if (m1.status === RUNNING) {
                        return -1;
                    } else if (m2.status === EXITED) {
                        return 1;
                    } else if (m1.status === EXITED) {
                        return -1;
                    } else if (m2.status === CREATED_STACK) {
                        return 1;
                    } else if (m1.status === CREATED_STACK) {
                        return -1;
                    } else if (m2.status === CREATED_FILE) {
                        return 1;
                    } else if (m1.status === CREATED_FILE) {
                        return -1;
                    } else if (m2.status === UNKNOWN) {
                        return 1;
                    } else if (m1.status === UNKNOWN) {
                        return -1;
                    }
                }
                return m1.name.localeCompare(m2.name);
            });

            // Group stacks by endpoint, sorting them so the local endpoint is first
            // and the rest are sorted alphabetically
            result = [
                ...result.reduce((acc, stack) => {
                    const endpoint = stack.endpoint || "current";
                    if (!acc.has(endpoint)) {
                        acc.set(endpoint, []);
                    }
                    acc.get(endpoint).push(stack);
                    return acc;
                }, new Map()).entries()
            ].map(([ endpoint, stacks ]) => ({
                endpoint,
                stacks
            })).sort((a, b) => {
                if (a.endpoint === "current" && b.endpoint !== "current") {
                    return -1;
                } else if (a.endpoint !== "current" && b.endpoint === "current") {
                    return 1;
                }
                return a.endpoint.localeCompare(b.endpoint);
            });

            // Filter to the server selected in the server overview panel
            if (this.selectedEndpoint) {
                result = result.filter(group => group.endpoint === this.selectedEndpoint);
            }

            return result;
        },

        isDarkTheme() {
            return document.body.classList.contains("dark");
        },

        selectedStackCount() {
            return Object.keys(this.selectedStacks).length;
        },

        /**
         * Determines if any filters are active.
         * @returns {boolean} True if any filter is active, false otherwise.
         */
        filtersActive() {
            return this.filterState.status != null || this.filterState.active != null || this.filterState.tags != null || this.searchText !== "";
        }
    },
    watch: {
        searchText() {
            for (let stack of this.agentStackList) {
                if (!this.selectedStacks[stack.id]) {
                    if (this.selectAll) {
                        this.disableSelectAllWatcher = true;
                        this.selectAll = false;
                    }
                    break;
                }
            }
        },
        selectAll() {
            if (!this.disableSelectAllWatcher) {
                this.selectedStacks = {};

                if (this.selectAll) {
                    this.agentStackList.forEach((item) => {
                        this.selectedStacks[item.id] = true;
                    });
                }
            } else {
                this.disableSelectAllWatcher = false;
            }
        },
        selectMode() {
            if (!this.selectMode) {
                this.selectAll = false;
                this.selectedStacks = {};
            }
        },
    },
    mounted() {
        window.addEventListener("scroll", this.onScroll);
    },
    beforeUnmount() {
        window.removeEventListener("scroll", this.onScroll);
    },
    methods: {
        /**
         * Handle user scroll
         * @returns {void}
         */
        onScroll() {
            if (window.top.scrollY <= 133) {
                this.windowTop = window.top.scrollY;
            } else {
                this.windowTop = 133;
            }
        },

        /**
         * Clear the search bar
         * @returns {void}
         */
        clearSearchText() {
            this.searchText = "";
        },
        /**
         * Connection status of an agent
         * @param {string} endpoint Agent endpoint ("current" for the local agent)
         * @returns {string} "online" or "offline"
         */
        agentStatus(endpoint) {
            return this.$root.agentStatusList[endpoint === "current" ? "" : endpoint] || "offline";
        },
        /**
         * Open a server's detail page and filter the stack list to it;
         * clicking the selected server again shows all servers and goes home
         * @param {string} endpoint Endpoint of the clicked server row
         * @returns {void}
         */
        toggleServerFilter(endpoint) {
            if (this.selectedEndpoint === endpoint) {
                this.selectedEndpoint = null;
                this.$router.push("/");
            } else {
                this.selectedEndpoint = endpoint;
                this.$router.push("/server/" + encodeURIComponent(endpoint));
            }
        },
        /**
         * Number of running stacks in an agent group
         * @param {object} agent Agent group with its (filtered) stacks
         * @returns {number} Count of running stacks
         */
        runningCount(agent) {
            return agent.stacks.filter(stack => stack.status === RUNNING).length;
        },
        /**
         * Update the StackList Filter
         * @param {object} newFilter Object with new filter
         * @returns {void}
         */
        updateFilter(newFilter) {
            this.filterState = newFilter;
        },
        /**
         * Deselect a stack
         * @param {number} id ID of stack
         * @returns {void}
         */
        deselect(id) {
            delete this.selectedStacks[id];
        },
        /**
         * Select a stack
         * @param {number} id ID of stack
         * @returns {void}
         */
        select(id) {
            this.selectedStacks[id] = true;
        },
        /**
         * Determine if stack is selected
         * @param {number} id ID of stack
         * @returns {bool} Is the stack selected?
         */
        isSelected(id) {
            return id in this.selectedStacks;
        },
        /**
         * Disable select mode and reset selection
         * @returns {void}
         */
        cancelSelectMode() {
            this.selectMode = false;
            this.selectedStacks = {};
        },
        /**
         * Show dialog to confirm pause
         * @returns {void}
         */
        pauseDialog() {
            this.$refs.confirmPause.show();
        },
        /**
         * Pause each selected stack
         * @returns {void}
         */
        pauseSelected() {
            Object.keys(this.selectedStacks)
                .filter(id => this.$root.stackList[id].active)
                .forEach(id => this.$root.getSocket().emit("pauseStack", id, () => { }));

            this.cancelSelectMode();
        },
        /**
         * Resume each selected stack
         * @returns {void}
         */
        resumeSelected() {
            Object.keys(this.selectedStacks)
                .filter(id => !this.$root.stackList[id].active)
                .forEach(id => this.$root.getSocket().emit("resumeStack", id, () => { }));

            this.cancelSelectMode();
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.shadow-box {
    height: calc(100vh - 150px);
    position: sticky;
    top: 10px;
    display: flex;
    flex-direction: column;
}

.stack-list {
    flex: 1;
    min-height: 0;
}

.status-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    background-color: #6c757d;

    &.online {
        background-color: #4caf50;
    }

    &.offline {
        background-color: $danger;
    }
}

.server-list {
    flex: none;
    margin: 0 -4px 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);

    .dark & {
        border-bottom-color: $dark-border-color;
    }
}

.server-list-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: $dark-font-color3;
    padding: 2px 10px 4px;
}

.server-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    font-size: 14px;
    font-weight: 500;
    transition: all ease-in-out 0.15s;

    &:hover {
        background-color: $highlight-white;
    }

    &.active {
        background-color: #cdf8f4;
    }

    .dark & {
        color: $dark-font-color;

        &:hover,
        &.active {
            background-color: $dark-bg2;
        }
    }

    .server-name {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .server-count {
        flex: none;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: $dark-font-color3;
    }

    .outdated-badge {
        flex: none;
        margin-right: 8px;
        font-size: 10px;
        font-weight: 600;
        background-color: $warning;
        color: #000;
    }
}

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.list-header {
    border-bottom: 1px solid #dee2e6;
    border-radius: 10px 10px 0 0;
    margin: -10px;
    margin-bottom: 10px;
    padding: 10px;

    .dark & {
        background-color: $dark-header-bg;
        border-bottom: 0;
    }
}

.header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-filter {
    display: flex;
    align-items: center;
}

@media (max-width: 770px) {
    .list-header {
        margin: -20px;
        margin-bottom: 10px;
        padding: 5px;
    }
}

.search-wrapper {
    display: flex;
    align-items: center;
}

.search-icon {
    padding: 10px;
    color: #c0c0c0;

    // Clear filter button (X)
    svg[data-icon="times"] {
        cursor: pointer;
        transition: all ease-in-out 0.1s;

        &:hover {
            opacity: 0.5;
        }
    }
}

.search-input {
    max-width: 15em;
}

.stack-item {
    width: 100%;
}

.tags {
    margin-top: 4px;
    padding-left: 67px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

.bottom-style {
    padding-left: 67px;
    margin-top: 5px;
}

.selection-controls {
    margin-top: 5px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.agent-select {
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: $dark-font-color3;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    user-select: none;

    // Pin the server header to the top of the scroll area while its
    // group scrolls; the next group's header pushes it out.
    position: sticky;
    top: 0;
    z-index: 5;
    background-color: #fff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);

    .dark & {
        background-color: $dark-bg;
        color: $dark-font-color;
        border-bottom-color: $dark-border-color;
    }

    .agent-name {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .stack-count {
        flex: none;
        margin-left: 8px;
        font-size: 12px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: $dark-font-color3;
    }
}
</style>
