/**
 * Shared studio lighting for the 3D views: a hard white "Sun", a blue bounce
 * from Earth, and a procedural environment (no HDR download) so metal, foil and
 * solar cells get real reflections. Also a shared Earth with its atmosphere.
 */
import { Environment, Lightformer, Stars } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { earthTexture } from './materials'

/**
 * `photoBackdrop`: leave the canvas see-through so the star photo behind it (CSS) shows,
 * instead of a flat colour and point stars.
 */
export function SpaceLights({ stars = true, photoBackdrop = false, sunOnly = false }: { stars?: boolean; photoBackdrop?: boolean; sunOnly?: boolean }) {
  return (
    <>
      {!photoBackdrop && <color attach="background" args={['#060b1a']} />}
      <ambientLight intensity={sunOnly ? 0.05 : 0.15} />
      {!sunOnly && (
        <>
          <directionalLight position={[5, 6, 4]} intensity={3.2} color="#fff6e8" castShadow={false} />
          <hemisphereLight args={['#9bb8ff', '#1a2c55', 0.6]} />
          <directionalLight position={[-4, -3, -2]} intensity={0.5} color="#5d88ff" />
        </>
      )}
      <Environment resolution={256}>
        <color attach="background" args={['#1b2440']} />
        <Lightformer form="rect" intensity={4} color="#fff3e0" position={[5, 5, 5]} scale={[6, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#7fa6ff" position={[-6, -2, 3]} scale={[8, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[0, 6, -6]} scale={3} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#3b5bbd" position={[0, -6, 0]} scale={[12, 12, 1]} rotation={[Math.PI / 2, 0, 0]} />
      </Environment>
      {stars && !photoBackdrop && <Stars radius={60} depth={30} count={1800} factor={2.5} saturation={0} fade speed={0.3} />}
    </>
  )
}

const atmoVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const atmoFragment = /* glsl */ `
  uniform float uPower;
  uniform float uGain;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
    gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * rim * uGain, rim * 0.85);
  }
`

/** Thin blue glow at Earth's edge, seen from space. */
export function useAtmosphere(power = 5, gain = 0.9) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmoVertex,
        fragmentShader: atmoFragment,
        uniforms: { uPower: { value: power }, uGain: { value: gain } },
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [power, gain],
  )
}

/** Earth (procedural texture) with its atmosphere. Radius in scene units. */
export function Earth({ radius, atmosphere = 1.015, spin = [Math.PI / 2, 0, 0] as [number, number, number], segments = 128 }: { radius: number; atmosphere?: number; spin?: [number, number, number]; segments?: number }) {
  const map = useMemo(() => earthTexture(), [])
  const atmo = useAtmosphere(4, 1.1)
  return (
    <group>
      <mesh rotation={spin}>
        <sphereGeometry args={[radius, segments, segments / 2]} />
        <meshStandardMaterial map={map} roughness={0.9} metalness={0} envMapIntensity={0} />
      </mesh>
      <mesh material={atmo}>
        <sphereGeometry args={[radius * atmosphere, 96, 48]} />
      </mesh>
    </group>
  )
}
