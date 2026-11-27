import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Was statt des Inhalts erscheint, wenn er sich nicht laden ließ. */
  fallback(retry: () => void): ReactNode
  /** Wird vor dem neuen Versuch aufgerufen, z. B. um einen Zwischenspeicher zu leeren. */
  onRetry?(): void
}

/** Fängt Fehler beim Nachladen ab (etwa ohne Netz), damit nicht die ganze App stehen bleibt. */
export class LoadBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  private readonly retry = () => {
    this.props.onRetry?.()
    this.setState({ failed: false })
  }

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children
  }
}
