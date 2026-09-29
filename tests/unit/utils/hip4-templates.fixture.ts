/**
 * Entries of Hyperliquid's HIP-4 template registry (POST /info
 * {"type":"outcomeTemplates"}) as served on 2026-09-29; long rules formats cut.
 */
export const OUTCOME_TEMPLATES = [
  {
    id: 'binaryPrice',
    role: { standaloneOutcome: { sideNames: ['Yes', 'No'] } },
    name: '{perp} above {threshold} at {time}?',
    description:
      'The market resolves to Yes if the {perp} price is above {threshold} at {time}, and otherwise resolves to No. Settlement is according to the {seconds}-second TWAP of {priceDescription} price ending at {time}. metadata=category:price|subCategory:N/A',
    keywords: [['perp', 'hlPerp'], ['priceDescription', 'string'], ['seconds', 'uInt'], ['threshold', 'uDecimal'], ['time', 'dateTime']],
  },
  {
    id: 'priceTouch',
    role: { standaloneOutcome: { sideNames: ['Yes', 'No'] } },
    name: '{perp} touches {target} by {time}',
    description: 'The market resolves to Yes if the {perp} price touches {target} at or before {time}, and otherwise resolves to No.',
    keywords: [['perp', 'hlPerp'], ['priceDescription', 'string'], ['seconds', 'uInt'], ['target', 'uDecimal'], ['time', 'dateTime']],
  },
  {
    id: 'sportsContestResult',
    role: 'question',
    name: '{competition} {stage}: {participantA} v {participantB}',
    description:
      'This {sport} market has three possible results: {participantA}, Draw, or {participantB}. It covers the {contestType} between {participantA} and {participantB}, scheduled for {scheduledStart} UTC (the "Contest").',
    keywords: [['competition', 'string'], ['contestType', 'string'], ['participantA', 'string'], ['participantB', 'string'], ['scheduledStart', 'dateTime'], ['sport', 'string'], ['stage', 'string']],
  },
  {
    id: 'sportsContestParticipant2',
    role: { questionOutcome: { parent: 'sportsContestResult' } },
    name: '{participant}',
    description: "This outcome resolves to Yes if {participant} is the sole winner of the Contest under the parent question's rules, and otherwise resolves to No.",
    keywords: [['participant', 'string']],
  },
  {
    id: 'sportsContestDraw2',
    role: { questionOutcome: { parent: 'sportsContestResult' } },
    name: 'Draw',
    description: "This outcome resolves to Yes if, under the parent question's rules, the Contest Result is a draw, and otherwise resolves to No.",
    keywords: [],
  },
  {
    id: 'sportsContestWinner',
    role: { standaloneOutcome: { sideNames: ['{shortNameA}', '{shortNameB}'] } },
    name: '{competition} {stage}: {participantA} v {participantB}',
    description: 'This {sport} market has two sides, {shortNameA} for {participantA} and {shortNameB} for {participantB}.',
    keywords: [['competition', 'string'], ['participantA', 'string'], ['participantB', 'string'], ['shortNameA', 'shortString'], ['shortNameB', 'shortString'], ['sport', 'string'], ['stage', 'string']],
  },
  {
    id: 'companyIpoConfirmed',
    role: { standaloneOutcome: { sideNames: ['Yes', 'No'] } },
    name: '{company} IPO confirmed by {dateTime}',
    description: "The market resolves to Yes if {company}'s first public common-equity offering is publicly confirmed at or before {dateTime}.",
    keywords: [['company', 'string'], ['dateTime', 'dateTime']],
  },
];
