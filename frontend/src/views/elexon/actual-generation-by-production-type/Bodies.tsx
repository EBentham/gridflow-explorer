/** Each dataset's main and key bodies: the shared stack and key, sized and named for it. */
import type { PageContext } from '../../define'
import { StackBody } from './StackBody'
import { StackKey } from './StackKey'

export const AgptBody = ({ ctx }: { ctx: PageContext }) => <StackBody ctx={ctx} height={460} />
export const AgwsBody = ({ ctx }: { ctx: PageContext }) => <StackBody ctx={ctx} height={380} />
export const AgptKey = ({ ctx }: { ctx: PageContext }) => <StackKey ctx={ctx} sumLabel="All types together" />
export const AgwsKey = ({ ctx }: { ctx: PageContext }) => <StackKey ctx={ctx} sumLabel="Wind and solar together" />
