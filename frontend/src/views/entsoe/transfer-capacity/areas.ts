/**
 * The in areas each dataset offers: those it holds rows for (the research
 * card's pairs), so the control never offers a read that comes back empty.
 * Names, border names, drawing order and the one-in-area-at-a-time read are
 * the template's (`_template/borders.ts`).
 */
import { IN_FR, IN_GB, IN_NL, type InArea } from '../../_template/borders'

/** Net transfer capacity GB and the Netherlands, nominated GB and France, allocated all three, the DC link limits GB only. */
export const IN_AREAS: Record<string, InArea[]> = {
  net_transfer_capacity: [IN_GB, IN_NL],
  total_capacity_allocated: [IN_GB, IN_FR, IN_NL],
  total_nominated_capacity: [IN_GB, IN_FR],
  dc_link_intraday_transfer_limits: [IN_GB],
}
