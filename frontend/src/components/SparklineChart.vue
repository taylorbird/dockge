<template>
    <div ref="container" class="sparkline" @mousemove="onHover" @mouseleave="hoverIndex = null">
        <svg v-if="points.length >= 2" :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none">
            <path :d="areaPath" class="area" />
            <path :d="linePath" class="line" vector-effect="non-scaling-stroke" />
            <line
                v-if="hoverIndex !== null"
                :x1="xAt(hoverIndex)" :x2="xAt(hoverIndex)" :y1="0" :y2="height"
                class="crosshair" vector-effect="non-scaling-stroke"
            />
            <circle
                :cx="xAt(hoverIndex !== null ? hoverIndex : points.length - 1)"
                :cy="yAt(hoverIndex !== null ? hoverIndex : points.length - 1)"
                r="3" class="dot"
            />
        </svg>
        <div v-else class="collecting">{{ $t("collectingData") }}</div>

        <div v-if="hoverIndex !== null && points[hoverIndex]" class="chart-tooltip" :style="tooltipStyle">
            <div class="tooltip-time">{{ timeLabel(points[hoverIndex].t) }}</div>
            <div class="tooltip-value">{{ format(points[hoverIndex].v) }}</div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        /** Samples to plot: [{ t: epochMs, v: number }] */
        points: {
            type: Array,
            required: true,
        },
        /** Formats a sample value for the tooltip */
        format: {
            type: Function,
            default: (v) => String(v),
        },
    },
    data() {
        return {
            width: 240,
            height: 48,
            hoverIndex: null,
        };
    },
    computed: {
        maxValue() {
            const max = Math.max(...this.points.map(p => p.v), 0);
            return max > 0 ? max * 1.1 : 1;
        },

        linePath() {
            return this.points
                .map((p, i) => `${i === 0 ? "M" : "L"}${this.xAt(i)},${this.yAt(i)}`)
                .join("");
        },

        areaPath() {
            return `${this.linePath}L${this.width},${this.height}L0,${this.height}Z`;
        },

        tooltipStyle() {
            // Keep the tooltip inside the chart: flip side past the middle
            const leftHalf = this.hoverIndex < this.points.length / 2;
            const x = (this.xAt(this.hoverIndex) / this.width) * 100;
            if (leftHalf) {
                return { left: `${x}%`,
                    transform: "translateX(8px)" };
            }
            return { left: `${x}%`,
                transform: "translateX(calc(-100% - 8px))" };
        },
    },
    methods: {
        xAt(i) {
            return (i / (this.points.length - 1)) * this.width;
        },

        yAt(i) {
            return this.height - (this.points[i].v / this.maxValue) * this.height;
        },

        onHover(event) {
            if (this.points.length < 2) {
                return;
            }
            const rect = this.$refs.container.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            const index = Math.round(ratio * (this.points.length - 1));
            this.hoverIndex = Math.min(Math.max(index, 0), this.points.length - 1);
        },

        timeLabel(t) {
            return new Date(t).toLocaleTimeString();
        },
    },
};
</script>

<style lang="scss" scoped>
.sparkline {
    position: relative;
    width: 100%;
    height: 48px;
    color: #2e86d9;

    .dark & {
        color: #3d90dc;
    }

    svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
    }
}

.line {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linejoin: round;
}

.area {
    fill: currentColor;
    opacity: 0.12;
    stroke: none;
}

.crosshair {
    stroke: currentColor;
    stroke-width: 1;
    opacity: 0.4;
}

.dot {
    fill: currentColor;
}

.collecting {
    height: 100%;
    display: flex;
    align-items: center;
    font-size: 12px;
    color: #6c757d;
}

.chart-tooltip {
    position: absolute;
    top: -8px;
    z-index: 10;
    pointer-events: none;
    background-color: #fff;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    padding: 4px 8px;
    font-size: 12px;
    white-space: nowrap;

    .dark & {
        background-color: #161b22;
        border-color: #1d2634;
    }

    .tooltip-time {
        color: #6c757d;
    }

    .tooltip-value {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
}
</style>
