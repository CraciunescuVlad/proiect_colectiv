import { useEffect, useRef, useState } from "react";

interface RadarBlipsProps {
    speed?: number;
    sweepSpeed?: number;
    sweepWidth?: number;
    population?: number;
    spawnInterval?: number;
}

interface Blip {
    id: number;
    left: number;
    top: number;
}

interface BlipState {
    intensity: number;
    revealed: boolean;
}

// Returns a random position, avoiding the title zone and the bottom paragraph zone
function randomPosition() {
    let left = 0;
    let top = 0;
    do {
        left = 6 + Math.random() * 88;
        top = 6 + Math.random() * 88;
    } while (
        (top > 36 && top < 64 && left > 18 && left < 82) ||
        (top > 80 && left > 14 && left < 86)
    );
    return { left, top };
}

// Returns a smooth 0..1 ramp between edge0 and edge1
function smoothstep(edge0: number, edge1: number, x: number) {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

export default function RadarBlips({
    speed = 1.0,
    sweepSpeed = 1.0,
    sweepWidth = 2.0,
    population = 7,
    spawnInterval = 600,
}: RadarBlipsProps) {
    const [blips, setBlips] = useState<Blip[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const elements = useRef<Map<number, HTMLDivElement>>(new Map());
    const states = useRef<Map<number, BlipState>>(new Map());
    const nextId = useRef(0);

    useEffect(() => {
        const spawn = () => {
            setBlips((prev) => {
                if (prev.length >= population) return prev;
                const { left, top } = randomPosition();
                const id = nextId.current++;
                states.current.set(id, { intensity: 0, revealed: false });
                return [...prev, { id, left, top }];
            });
        };
        const interval = setInterval(spawn, spawnInterval);
        return () => clearInterval(interval);
    }, [population, spawnInterval]);

    useEffect(() => {
        let frameId: number;
        let prevTime = performance.now();
        const toRemove: number[] = [];

        const loop = (now: number) => {
            frameId = requestAnimationFrame(loop);
            const container = containerRef.current;
            if (!container) return;

            const dt = Math.min((now - prevTime) / 1000, 0.05);
            prevTime = now;

            const aspect = container.offsetWidth / container.offsetHeight;
            const beamPhase = now * 0.001 * speed * sweepSpeed;
            const decay = Math.exp(-dt / 0.7);

            toRemove.length = 0;

            states.current.forEach((state, id) => {
                const el = elements.current.get(id);
                if (!el) return;

                const fx = parseFloat(el.dataset.left || "50") / 100;
                const fy = parseFloat(el.dataset.top || "50") / 100;
                const stx = (fx * 2 - 1) * aspect;
                const sty = 1 - fy * 2;
                const angle = Math.atan2(sty, stx);

                const beam = Math.pow(Math.max(0.5 * Math.sin(angle + beamPhase) + 0.5, 0), sweepWidth);
                const target = smoothstep(0.55, 0.95, beam);

                state.intensity = Math.max(target, state.intensity * decay);
                if (state.intensity > 0.6) state.revealed = true;

                el.style.opacity = state.intensity.toFixed(3);

                if (state.revealed && state.intensity < 0.04) {
                    toRemove.push(id);
                }
            });

            if (toRemove.length > 0) {
                toRemove.forEach((id) => {
                    states.current.delete(id);
                    elements.current.delete(id);
                });
                setBlips((prev) => prev.filter((b) => !toRemove.includes(b.id)));
            }
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [speed, sweepSpeed, sweepWidth]);

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-[5]">
            {blips.map((b) => (
                <div
                    key={b.id}
                    data-left={b.left}
                    data-top={b.top}
                    ref={(node) => {
                        if (node) elements.current.set(b.id, node);
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${b.left}%`, top: `${b.top}%`, opacity: 0 }}
                >
                    <svg width="14" height="14">
                        <circle cx="7" cy="7" r="6" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                    </svg>
                </div>
            ))}
        </div>
    );
}