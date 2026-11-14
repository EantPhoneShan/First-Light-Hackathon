import { Link } from 'react-router-dom'
import { Screen } from '@/components/Screen'

export function NotFound() {
  return (
    <Screen title="Lost in space" subtitle="That page doesn't exist.">
      <Link to="/" className="text-accent underline">Back to the title screen</Link>
    </Screen>
  )
}
