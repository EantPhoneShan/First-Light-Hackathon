/** Data attached to every draggable item on the workbench. */
export interface DragData {
  /** Part id, or bus id when kind is 'bus'. */
  id: string
  kind: 'part' | 'bus'
  /** True when dragged off the craft (dropping it on the tray removes it). */
  fromCraft: boolean
}

export const TRAY_ID = 'tray'
export const CRAFT_ID = 'craft'
