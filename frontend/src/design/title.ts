import { useEffect } from 'react'

const APP = 'gridflow Explorer'

/** Names the browser tab after the screen: `Generation mix – gridflow Explorer`. */
export function useDocumentTitle(screen: string | null) {
  useEffect(() => {
    document.title = screen ? `${screen} – ${APP}` : APP
  }, [screen])
}
