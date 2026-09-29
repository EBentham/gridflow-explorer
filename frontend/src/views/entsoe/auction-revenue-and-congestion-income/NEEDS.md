# NEEDS: entsoe / auction-revenue-and-congestion-income

No template or endpoint gap blocked this page. What follows is for research and for the
source list.

## Domain questions for research (labelled on the page, not guessed)

1. **Revenue per MW allocated.** The page draws `total_capacity_allocated` (GB as the in
   area) under the revenue on the same borders. In 16–22 Sep the two move together:
   GB–Netherlands revenue is €0 while its capacity allocated is 0 MW (to 23:00 BST on
   19 Sep, when both start: 850 MW and €153 that hour), and GB–Belgium's allocated drops to
   0 MW on 21 Sep as its revenue falls to €799 that day, then €0. Dividing the two would
   give the price each border's capacity sold at, a useful input to a power-stack model.
   The page works out no ratio, because it isn't confirmed that the capacity allocated
   (A26/A29, "already allocated in past auctions") counts the same auctions and direction as
   the revenue (A25/B07). Research the ENTSO-E API guide for both document types.
2. **Direction.** As on the flows and transfer capacity pages: which way the capacity sold
   runs for `in_Domain` GB / `out_Domain` Netherlands or Belgium. The page names the border
   in area first, with no arrow, and never says import or export.
3. **Currency.** The rows carry no currency; the card reads euros from the column name and
   the vault. The page says so in a caveat.
4. **Congestion income.** gridflow asks for the implicit and flow-based data item, and every
   reply was empty. If an explicit-allocation congestion income exists for GB's borders,
   that is a gridflow connector item, not an Explorer one.

## Source list text (backend)

5. **The duplicate note is out of date.** The note says "432 rows, 264 distinct keys:
   x1.64". Measured on 29 Sep: 1,296 rows in `silver_entsoe_auction_revenue`, 744 distinct
   (timestamp, in area, out area, business type) keys (x1.74), no key holding two different
   amounts. The rows endpoint returns 744 held values over 31 Jul – 22 Sep, one per key. The
   page doesn't print the note.
