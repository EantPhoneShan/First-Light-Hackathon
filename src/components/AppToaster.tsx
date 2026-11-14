import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'

const PHONE = '(max-width: 639px)'

/** Alerts sit top-right on wide screens, and at the bottom on phones so they don't cover the pinned gauges. */
export function AppToaster() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE)
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return <Toaster theme="dark" position={phone ? 'bottom-center' : 'top-right'} richColors />
}
