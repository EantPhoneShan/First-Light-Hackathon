/**
 * Shared studio lighting for the 3D views: a hard white "Sun", a blue bounce
 * from Earth, and a procedural environment (no HDR download) so metal, foil and
 * solar cells get real reflections.
 */
import { Environment, Lightformer, Stars } from '@react-three/drei'

export function SpaceLights({ stars = true }: { stars?: boolean }) {
  return (
    <>
      <color attach="background" args={['#060b1a']} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 6, 4]} intensity={3.2} color="#fff6e8" castShadow={false} />
      <hemisphereLight args={['#9bb8ff', '#1a2c55', 0.6]} />
      <directionalLight position={[-4, -3, -2]} intensity={0.5} color="#5d88ff" />
      <Environment resolution={256}>
        <color attach="background" args={['#1b2440']} />
        <Lightformer form="rect" intensity={4} color="#fff3e0" position={[5, 5, 5]} scale={[6, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#7fa6ff" position={[-6, -2, 3]} scale={[8, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[0, 6, -6]} scale={3} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#3b5bbd" position={[0, -6, 0]} scale={[12, 12, 1]} rotation={[Math.PI / 2, 0, 0]} />
      </Environment>
      {stars && <Stars radius={60} depth={30} count={1800} factor={2.5} saturation={0} fade speed={0.3} />}
    </>
  )
}
