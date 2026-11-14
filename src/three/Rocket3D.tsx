/**
 * Launch-vehicle viewer for the Orbit & launch tab. Shows the chosen rocket in
 * 3D, with your spacecraft inside, and an exploded view that pulls the stack
 * apart and labels every piece. Loaded lazily (three.js).
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Expand, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { Bus, Launcher, Part } from "@/engine/types";
import { cn } from "@/lib/cn";
import {
  Booster,
  FairingHalf,
  FirstStage,
  Interstage,
  Payload,
  Person,
  rocketSpec,
  SecondStage,
  stackOf,
  type RocketSpec,
} from "./rocketParts";
import { SpaceLights } from "./Stage";

type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;

interface Piece {
  id: string;
  label: string;
  what: string;
  /** Bottom of the piece in the assembled stack, and its height. */
  y: number;
  h: number;
  render: () => ReactNode;
}

function pieces(
  spec: RocketSpec,
  bus: Bus | undefined,
  parts: Part[],
): Piece[] {
  const st = stackOf(spec);
  const out: Piece[] = [
    {
      id: "s1",
      label: "First stage",
      what: `${spec.s1.engines} engine${spec.s1.engines > 1 ? "s" : ""} lift everything off the pad. Burns about 2.5 minutes, then drops away.`,
      y: st.s1,
      h: spec.s1.len,
      render: () => <FirstStage spec={spec} />,
    },
    {
      id: "inter",
      label: "Interstage",
      what: "Joins the two stages and covers the upper stage engine.",
      y: st.inter,
      h: spec.inter.len,
      render: () => <Interstage spec={spec} />,
    },
    {
      id: "s2",
      label: "Upper stage",
      what: "One engine with a huge bell, made for vacuum. Pushes the payload the rest of the way to orbit speed.",
      y: st.s2,
      h: spec.s2.len,
      render: () => <SecondStage spec={spec} />,
    },
    {
      id: "payload",
      label:
        spec.payload === "dispenser"
          ? "Rideshare dispenser"
          : spec.payload === "capsule"
            ? "Cargo capsule"
            : "Your spacecraft",
      what:
        spec.payload === "dispenser"
          ? "Your CubeSat rides in a spring-loaded box (orange) beside other satellites."
          : spec.payload === "capsule"
            ? "Your CubeSat goes up packed as cargo, then the Station crew pushes it out."
            : "Sits on an adapter ring with its panels folded until it reaches orbit.",
      y: st.payload,
      h: Math.max(spec.d * 0.6, 1),
      render: () => <Payload spec={spec} bus={bus} parts={parts} />,
    },
  ];
  if (spec.fairing.len > 0 && spec.payload !== "capsule")
    out.push({
      id: "fairing",
      label: "Payload fairing",
      what: "Two shells that shield the payload from air and heat, then split open above the atmosphere.",
      y: st.fairing,
      h: spec.fairing.len,
      render: () => (
        <>
          <FairingHalf spec={spec} side={1} />
          <FairingHalf spec={spec} side={-1} />
        </>
      ),
    });
  return out;
}

/** Rocket lies diagonally across the frame (a hero shot); fit its length to the wide canvas. */
const TILT = -1.0;

function CameraFit({
  height,
  resetKey,
  controls,
}: {
  height: number;
  resetKey: number;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const half = (camera.fov * Math.PI) / 360;
    const aspect = size.width / Math.max(1, size.height);
    // Projected extents of the tilted rocket, then the distance that fits both.
    const vert = Math.abs(Math.cos(TILT)) * height + 6;
    const horiz = Math.abs(Math.sin(TILT)) * height + 6;
    const d =
      Math.max(
        vert / 2 / Math.tan(half),
        horiz / 2 / (Math.tan(half) * aspect),
      ) * 1.1;
    camera.position.set(d * 0.18, d * 0.12, d);
    camera.near = 0.05;
    camera.far = d * 20;
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
  }, [height, resetKey, camera, controls, size.width, size.height]);
  return null;
}

/** Turns the rocket slowly on its own axis so every side of the livery comes round. */
function Spin({ paused, children }: { paused: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && !paused) ref.current.rotation.y += dt * 0.25;
  });
  return <group ref={ref}>{children}</group>;
}

/** Slides a piece to its (exploded or stacked) height. */
function Slide({ y, children }: { y: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current)
      ref.current.position.y +=
        (y - ref.current.position.y) * (1 - Math.exp(-dt * 6));
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      {children}
    </group>
  );
}

export default function Rocket3D({
  launcher,
  bus,
  parts,
}: {
  launcher: Launcher;
  bus?: Bus;
  parts: Part[];
}) {
  const spec = useMemo(() => rocketSpec(launcher), [launcher]);
  const list = useMemo(() => pieces(spec, bus, parts), [spec, bus, parts]);
  const [exploded, setExploded] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const controls = useRef<OrbitControlsImpl>(null);

  const gap = spec.d * 1.8;
  const total = stackOf(spec).top + (exploded ? gap * list.length : 0);

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-xl border border-space-700 bg-[url('/assets/bg/stars.webp')] bg-cover bg-center sm:h-[540px]">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 32 }}
        gl={{ alpha: true }}
        aria-label={`3D model of the ${launcher.name}`}
      >
        <SpaceLights photoBackdrop />
        <CameraFit
          height={total}
          resetKey={resetKey + (exploded ? 1000 : 0)}
          controls={controls}
        />
        <OrbitControls
          ref={controls}
          makeDefault
          enablePan={false}
          minDistance={spec.d * 2}
          maxDistance={total * 4}
        />
        <group rotation={[0, 0, TILT]}>
          <group position={[0, -total / 2, 0]}>
            <Spin paused={!!hover}>
              {/* A 1.8 m person by the base, for scale */}
              <group position={[spec.d * (spec.boosters ? 2.2 : 1.2), 0, 0]}>
                <Person />
                <Html
                  position={[0, 2.4, 0]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <span className="text-[10px] whitespace-nowrap text-muted">
                    1.8 m person
                  </span>
                </Html>
              </group>

              {list.map((p, i) => {
                const y = p.y + (exploded ? gap * i : 0);
                return (
                  <Slide key={p.id} y={y}>
                    <group
                      onPointerOver={(e) => (
                        e.stopPropagation(),
                        setHover(p.id)
                      )}
                      onPointerOut={() =>
                        setHover((h) => (h === p.id ? null : h))
                      }
                    >
                      {p.render()}
                    </group>
                    {(exploded || hover === p.id) && (
                      // Exploded: a short tag on alternating sides; hover adds the explanation.
                      <Html
                        position={[
                          (i % 2 === 0 ? 1 : -1) *
                            (spec.d * 0.7 + (spec.boosters ? spec.d * 1.4 : 0)),
                          p.h / 2,
                          0,
                        ]}
                        style={{ pointerEvents: "none" }}
                        zIndexRange={[20, 0]}
                      >
                        <div
                          className={cn(
                            "-translate-y-1/2 rounded-lg border bg-space-900/95 px-2.5 py-1 text-xs shadow-xl",
                            i % 2 === 0 ? "" : "-translate-x-full",
                            hover === p.id
                              ? "w-56 border-accent"
                              : "border-space-600 whitespace-nowrap",
                          )}
                        >
                          <p className="font-medium text-ink">{p.label}</p>
                          {hover === p.id && (
                            <p className="mt-0.5 text-muted">{p.what}</p>
                          )}
                        </div>
                      </Html>
                    )}
                  </Slide>
                );
              })}

              {spec.boosters > 0 &&
                [-1, 1].map((s) => (
                  <group
                    key={s}
                    position={[s * spec.d * (exploded ? 2.4 : 1.02), 0, 0]}
                  >
                    <Booster spec={spec} />
                    {exploded && s === -1 && (
                      <Html
                        position={[-spec.d * 0.8, spec.s1.len * 0.6, 0]}
                        style={{ pointerEvents: "none" }}
                      >
                        <div className="-translate-x-full -translate-y-1/2 rounded-lg border border-space-600 bg-space-900/95 px-2.5 py-1 text-xs whitespace-nowrap shadow-xl">
                          <p className="font-medium text-ink">Side boosters</p>
                          <p className="text-muted">Drop off first</p>
                        </div>
                      </Html>
                    )}
                  </group>
                ))}
            </Spin>
          </group>
        </group>
      </Canvas>

      <div className="absolute top-2 left-2 flex gap-1.5">
        <button
          onClick={() => setExploded((v) => !v)}
          aria-pressed={exploded}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs backdrop-blur",
            exploded
              ? "border-accent bg-accent/20 text-ink"
              : "border-space-600 bg-space-900/70 text-muted hover:text-ink",
          )}
        >
          <Expand className="size-3.5" aria-hidden />
          Exploded view
        </button>
        <button
          onClick={() => setResetKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 bg-space-900/70 px-2 py-1.5 text-xs text-muted backdrop-blur hover:text-ink"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset view
        </button>
      </div>
      <p className="pointer-events-none absolute right-2 bottom-2 rounded bg-space-950/70 px-2 py-1 text-[11px] text-muted">
        {launcher.name} · about {Math.round(stackOf(spec).top)} m tall
      </p>
    </div>
  );
}
