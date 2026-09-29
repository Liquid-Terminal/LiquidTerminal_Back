import {
  formatHip4DateTime,
  formatHip4Number,
  indexOutcomeTemplates,
  isPlaceholderName,
  parseDescriptionFields,
  priceBucketOutcomeName,
  priceBucketQuestionTitle,
  renderSideName,
  renderTemplateFormat,
  renderTemplateRules,
  renderTemplateTitle,
  templatePriceFields,
} from '../../../src/utils/hip4-market-names.util';
import { OUTCOME_TEMPLATES } from './hip4-templates.fixture';

const templates = indexOutcomeTemplates(OUTCOME_TEMPLATES);

// Real descriptions from Hyperliquid's outcomeMeta / HypeDexer rows (2026-09).
const BINARY_HYPE = 'perp:HYPE|priceDescription:HYPE-USDC perp mark|seconds:60|threshold:90.416|time:20260928-1200';
const TOUCH_BTC = 'perp:BTC|priceDescription:BTC-USDC mark|seconds:1|target:100000|time:20261001-0000';
const NATIONS_LEAGUE =
  'competition:UEFA Nations League|contestType:Match|countedPlay:regulation time, 90 minutes plus stoppage time|officialSource:Union of European Football Associations|participantA:Belgium|participantB:Turkiye|resolutionDeadline:20261003-1845|scheduledStart:20261002-1845|season:2026/27|sport:Soccer|stage:League A, Matchday 3';
const NFL =
  'competition:NFL|contestType:game|participantA:Philadelphia Eagles|participantB:Chicago Bears|scheduledStart:20260929-0015|shortNameA:Eagles|shortNameB:Bears|sport:football|stage:Regular Season';
const BUCKET_QUESTION = 'class:priceBucket|underlying:BTC|expiry:20260509-0600|priceThresholds:77991,81174|period:1d';

describe('template registry', () => {
  it('indexes templates by id with their keyword types, skipping malformed entries', () => {
    const idx = indexOutcomeTemplates([...OUTCOME_TEMPLATES, null, { id: 3 }, { name: 'x' }]);
    expect(idx.size).toBe(OUTCOME_TEMPLATES.length);
    expect(idx.get('binaryPrice')?.keywordTypes).toMatchObject({ threshold: 'uDecimal', time: 'dateTime' });
    expect(indexOutcomeTemplates({ not: 'a list' }).size).toBe(0);
  });

  it('reads key:value descriptions, keeping colons inside values', () => {
    expect(parseDescriptionFields('officialSource:federalreserve.gov|url:https://x.io/a|index:0')).toEqual({
      officialSource: 'federalreserve.gov',
      url: 'https://x.io/a',
      index: '0',
    });
    expect(parseDescriptionFields('')).toEqual({});
  });
});

describe('titles', () => {
  it('renders a price template with formatted numbers and UTC times', () => {
    expect(renderTemplateTitle('template:binaryPrice', BINARY_HYPE, templates)).toBe('HYPE above 90.416 at Sep 28, 12:00 PM UTC?');
    expect(renderTemplateTitle('template:priceTouch', TOUCH_BTC, templates)).toBe('BTC touches 100,000 by Oct 1, 12:00 AM UTC');
    expect(renderTemplateTitle('template:companyIpoConfirmed', 'company:Anthropic|dateTime:20261031-2359', templates)).toBe(
      'Anthropic IPO confirmed by Oct 31, 11:59 PM UTC'
    );
  });

  it('renders a question and its outcomes', () => {
    expect(renderTemplateTitle('template:sportsContestResult', NATIONS_LEAGUE, templates)).toBe(
      'UEFA Nations League League A, Matchday 3: Belgium v Turkiye'
    );
    expect(renderTemplateTitle('template:sportsContestParticipant2', 'participant:Belgium', templates)).toBe('Belgium');
    expect(renderTemplateTitle('template:sportsContestDraw2', '', templates)).toBe('Draw');
    expect(renderTemplateTitle('template fallback', 'other', templates)).toBe('Other');
  });

  it('gives no title for an unknown template, a missing keyword, or a plain name', () => {
    expect(renderTemplateTitle('template:notInRegistry', BINARY_HYPE, templates)).toBeNull();
    expect(renderTemplateTitle('template:binaryPrice', 'perp:HYPE|threshold:90', templates)).toBeNull();
    expect(renderTemplateTitle('Recurring', BINARY_HYPE, templates)).toBeNull();
    expect(renderTemplateTitle('template:binaryPrice', BINARY_HYPE, new Map())).toBeNull();
  });

  it('renders the rules without doubling "UTC"', () => {
    expect(renderTemplateRules('template:sportsContestResult', NATIONS_LEAGUE, templates)).toContain(
      'scheduled for Oct 2, 6:45 PM UTC (the "Contest")'
    );
    expect(renderTemplateRules('template:binaryPrice', BINARY_HYPE, templates)).toMatch(
      /^The market resolves to Yes if the HYPE price is above 90.416 at Sep 28, 12:00 PM UTC,/
    );
    expect(renderTemplateRules('Recurring', BINARY_HYPE, templates)).toBeNull();
  });
});

describe('sides', () => {
  it('renders templated side names from the outcome description', () => {
    expect(renderSideName('template:Yes', BINARY_HYPE)).toBe('Yes');
    expect(renderSideName('template:{shortNameA}', NFL)).toBe('Eagles');
    expect(renderSideName('template:{shortNameB}', NFL)).toBe('Bears');
    expect(renderSideName('San Antonio', '')).toBe('San Antonio');
    expect(renderSideName('template:{shortNameA}', '')).toBeNull();
  });
});

describe('price fields', () => {
  it('maps the price templates onto class / underlying / strike / expiry', () => {
    expect(templatePriceFields('template:binaryPrice', BINARY_HYPE)).toEqual({
      cls: 'priceBinary',
      underlying: 'HYPE',
      targetPrice: 90.416,
      expiry: '20260928-1200',
    });
    expect(templatePriceFields('template:priceTouch', TOUCH_BTC)).toEqual({
      cls: 'priceTouch',
      underlying: 'BTC',
      targetPrice: 100000,
      expiry: '20261001-0000',
    });
    expect(templatePriceFields('template:sportsContestWinner', NFL)).toBeNull();
    expect(templatePriceFields('Recurring', BINARY_HYPE)).toBeNull();
  });
});

describe('price buckets', () => {
  it('titles the question and names each range', () => {
    expect(priceBucketQuestionTitle(BUCKET_QUESTION)).toBe('BTC price at May 9, 6:00 AM UTC');
    expect(priceBucketOutcomeName(BUCKET_QUESTION, 'index:0')).toBe('BTC < 77,991');
    expect(priceBucketOutcomeName(BUCKET_QUESTION, 'index:1')).toBe('BTC 77,991–81,174');
    expect(priceBucketOutcomeName(BUCKET_QUESTION, 'index:2')).toBe('BTC ≥ 81,174');
  });

  it('names nothing outside a bucket question or its ranges', () => {
    expect(priceBucketOutcomeName(BUCKET_QUESTION, 'index:3')).toBeNull();
    expect(priceBucketOutcomeName(BUCKET_QUESTION, 'other')).toBeNull();
    expect(priceBucketOutcomeName('This market has three possible outcomes', 'index:0')).toBeNull();
    expect(priceBucketQuestionTitle('class:priceBinary|underlying:BTC')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats template times and numbers', () => {
    expect(formatHip4DateTime('20260929-0015')).toBe('Sep 29, 12:15 AM UTC');
    expect(formatHip4DateTime('20261231-2359')).toBe('Dec 31, 11:59 PM UTC');
    expect(formatHip4DateTime('2026-09-29')).toBeNull();
    expect(formatHip4Number('83189.5')).toBe('83,189.5');
    expect(formatHip4Number('0.25')).toBe('0.25');
    expect(formatHip4Number('abc')).toBe('abc');
  });

  it('keeps a format whole or not at all', () => {
    expect(renderTemplateFormat('{a} and {b}', { a: '1', b: '2' })).toBe('1 and 2');
    expect(renderTemplateFormat('{a} and {b}', { a: '1' })).toBeNull();
    expect(renderTemplateFormat('Yes', {})).toBe('Yes');
  });

  it('tells deployer placeholders from names', () => {
    expect(isPlaceholderName('Recurring Named Outcome')).toBe(true);
    expect(isPlaceholderName('template:binaryPrice')).toBe(true);
    expect(isPlaceholderName('#60240', '#60240')).toBe(true);
    expect(isPlaceholderName('Belgium')).toBe(false);
    expect(isPlaceholderName('Recurring Fallback')).toBe(false);
  });
});
