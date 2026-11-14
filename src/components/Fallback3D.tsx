import { Component, type ReactNode } from 'react'

/** If WebGL isn't available (old device, blocked GPU), show the 2D version instead of crashing. */
export class Fallback3D extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
