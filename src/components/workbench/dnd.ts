/** Data attached to every draggable part. */
export interface DragData {
  partId: string
  /** Slot the part is being dragged out of; null when dragged from the tray. */
  fromSlot: string | null
}

export const TRAY_ID = 'tray'
