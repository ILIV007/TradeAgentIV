// TradeAgent IV — channel language (en/fa). The admin picks the channel
// language in the bot panel (config key 'lang'); every channel post is
// rendered from these strings. Numbers always stay Latin digits.
// Chart images keep English labels: QuickChart's font cannot shape
// Persian script, so chart text would render broken.

const STR = {
  en: {
    tehran: 'Tehran', coin: 'Coin', price: 'Price',
    snapshot: 'MARKET SNAPSHOT', dominance: 'Dominance', fearGreed: 'Fear & Greed', regime: 'Regime',
    tier1: 'Tier 1 — Blue Chips', tier2: 'Tier 2 — Utility & L2s', tier3: 'Tier 3 — Meme & AI', coinsWord: 'coins',
    best: 'Best', weakest: 'Weakest', greenTail: 'green', mood: { 'risk-on': 'risk-on', 'risk-off': 'risk-off', 'flat and indecisive': 'flat and indecisive', mixed: 'mixed' },
    chartCaption: 'Bitcoin · last 7 days · price vs its average',
    volume: 'VOLUME LEADERS', daily: 'DAILY INTELLIGENCE', globalMarket: 'Global Market', cap: 'Cap', vol: 'Vol',
    sentiment: 'Market Sentiment', perfBoard: 'Performance Board', topPerformer: 'Top Performer', weakestLink: 'Weakest Link', trendingNow: 'Trending Now',
    trending: 'TRENDING COINS', noTrending: 'No trending data available.',
    fng: 'FEAR & GREED INDEX', unavailable: 'Data unavailable', yesterday: 'Yesterday', updated: 'Updated',
    marketState: 'MARKET STATE', intensity: 'Intensity', mode: 'Mode', aiIntel: 'AI MARKET INTELLIGENCE', keyMetrics: 'Key Metrics', global: 'Global', futuresPulse: 'Futures Pulse', funding: 'Funding',
    priceAlert: 'PRICE ALERT', moveUp: 'BIG MOVE UP', moveDown: 'BIG MOVE DOWN', move24: '24h move', current: 'Current',
    futures: 'FUNDING RATES & FUTURES',
    moversTitle: 'TOP MOVERS (24H)', moversRich: 'Top Movers — 24h', topGainers: 'Top Gainers', topLosers: 'Top Losers', noMovers: 'No movers data available',
    moversNote: '⭐ = tracked by TradeAgent IV · market-wide scan (Binance)', moversCaption: 'Market-wide top movers · last 24 hours',
    analysis: 'TradeAgent IV — Market Analysis', overview: 'Overview', drivers: 'Ranked drivers', scenarios: 'Scenarios',
    caseBase: 'Base case', caseBull: 'Bull case', caseBear: 'Bear case', trigger: 'trigger', watch: 'Watch', invalidation: 'Invalidation',
    disclaimer: '⚠️ Educational analysis, not financial advice.',
    numBtcPrice: 'BTC price', numBtcCh: 'BTC 24h / 7d', numRange24: 'Range 24h', numRange7: 'Range 7d', numFunding: 'Funding (BTC)', numOi: 'Deribit OI', numDvol: 'DVOL', numFng: 'Fear & Greed', numDom: 'BTC dominance', numStables: 'Stablecoins 7d', was: 'was', numbers: 'Market in numbers',
    brief: 'Morning Brief', majorsCap: 'Overnight — the majors', briefMoversCap: 'Overnight movers — tracked coins', breadth: 'Breadth', breadthTail: 'coins green overnight',
    levelsCap: 'Bitcoin key levels', high: 'High', low: 'Low', totalsCap: 'Market totals', totalCap: 'Total market cap', vol24: 'Volume 24h', headline: 'Overnight headline',
    weekly: 'Weekly Deep Dive', regimePath: 'Regime path', glanceCap: 'The week at a glance (7d)', allCoins: 'All', allCoinsTail: 'coins — 7d performance',
    scorecardCap: '📋 Our scenario scorecard — this week', scCase: 'Case', scTrig: 'Triggered', scFollow: 'Follow-through', scHeld: 'held',
    scorecardEmpty: '📋 Scenario scorecard: every flagship call is now recorded — the first graded week appears here next Friday.',
    aheadCap: "Next week's high-impact calendar", day: 'Day', event: 'Event', weeklyChartCap: 'Top movers of the week (7d %)',
    macroCal: 'Macro Calendar', macroSub: 'ForexFactory · all times Tehran · 🔴 = high impact', time: 'Time', forecast: 'Forecast', previous: 'Previous', actual: 'Actual',
    macroNone: 'No medium or high-impact releases today.', minor: 'Low-impact releases', nextHigh: 'Next high-impact',
    flash: 'Event Flash', watchTitle: 'Macro Watch', todayAt: 'Today', highImpact: 'high impact',
    watchText: 'The print lands shortly — the result and what it means for the market will follow here within minutes.',
    regimeNames: {}, lean: { UP: 'UP', DOWN: 'DOWN', FLAT: 'FLAT' },
    fngNames: { extremeFear: 'EXTREME FEAR', fear: 'FEAR', neutral: 'NEUTRAL', greed: 'GREED', extremeGreed: 'EXTREME GREED' },
  },
  fa: {
    tehran: 'تهران', coin: 'کوین', price: 'قیمت',
    snapshot: 'نمای بازار', dominance: 'دامیننس', fearGreed: 'ترس و طمع', regime: 'رژیم بازار',
    tier1: 'سطح ۱ — بلوچیپ‌ها', tier2: 'سطح ۲ — کاربردی و لایه‌دوها', tier3: 'سطح ۳ — میم و هوش مصنوعی', coinsWord: 'کوین',
    best: 'بهترین', weakest: 'ضعیف‌ترین', greenTail: 'سبز', mood: { 'risk-on': 'ریسک‌پذیر', 'risk-off': 'ریسک‌گریز', 'flat and indecisive': 'خنثی و مردد', mixed: 'مختلط' },
    chartCaption: 'بیت‌کوین · ۷ روز اخیر · قیمت در برابر میانگین',
    volume: 'پیشتازان حجم', daily: 'گزارش روزانه بازار', globalMarket: 'بازار جهانی', cap: 'ارزش بازار', vol: 'حجم',
    sentiment: 'احساسات بازار', perfBoard: 'تابلوی عملکرد', topPerformer: 'بهترین عملکرد', weakestLink: 'ضعیف‌ترین حلقه', trendingNow: 'ترندهای روز',
    trending: 'کوین‌های ترند', noTrending: 'داده‌ای برای ترندها موجود نیست.',
    fng: 'شاخص ترس و طمع', unavailable: 'داده موجود نیست', yesterday: 'دیروز', updated: 'به‌روزرسانی',
    marketState: 'وضعیت بازار', intensity: 'شدت', mode: 'حالت', aiIntel: 'تحلیل هوشمند بازار', keyMetrics: 'شاخص‌های کلیدی', global: 'جهانی', futuresPulse: 'نبض فیوچرز', funding: 'فاندینگ',
    priceAlert: 'هشدار قیمت', moveUp: 'حرکت بزرگ صعودی', moveDown: 'حرکت بزرگ نزولی', move24: 'حرکت ۲۴ ساعته', current: 'قیمت فعلی',
    futures: 'نرخ فاندینگ و فیوچرز',
    moversTitle: 'برترین حرکت‌ها (۲۴ ساعت)', moversRich: 'برترین حرکت‌ها — ۲۴ ساعت', topGainers: 'بیشترین رشد', topLosers: 'بیشترین ریزش', noMovers: 'داده‌ای برای حرکت‌ها موجود نیست',
    moversNote: '⭐ = تحت پوشش TradeAgent IV · اسکن کل بازار (بایننس)', moversCaption: 'برترین حرکت‌های کل بازار · ۲۴ ساعت اخیر',
    analysis: 'تحلیل بازار — TradeAgent IV', overview: 'مرور کلی', drivers: 'محرک‌های اصلی (به ترتیب اهمیت)', scenarios: 'سناریوها',
    caseBase: 'سناریوی پایه', caseBull: 'سناریوی صعودی', caseBear: 'سناریوی نزولی', trigger: 'تریگر', watch: 'زیر نظر', invalidation: 'ابطال تحلیل',
    disclaimer: '⚠️ تحلیل آموزشی است، نه توصیه مالی.',
    numBtcPrice: 'قیمت بیت‌کوین', numBtcCh: 'بیت‌کوین ۲۴س / ۷ر', numRange24: 'بازه ۲۴ ساعته', numRange7: 'بازه ۷ روزه', numFunding: 'فاندینگ (BTC)', numOi: 'اوپن اینترست دریبیت', numDvol: 'شاخص نوسان (DVOL)', numFng: 'ترس و طمع', numDom: 'دامیننس بیت‌کوین', numStables: 'استیبل‌کوین‌ها (۷ روزه)', was: 'قبلاً', numbers: 'بازار در یک نگاه عددی',
    brief: 'گزارش صبحگاهی', majorsCap: 'دیشب — ارزهای اصلی', briefMoversCap: 'برترین حرکت‌های شبانه — کوین‌های تحت پوشش', breadth: 'وسعت بازار', breadthTail: 'کوین سبز در شبانه‌روز گذشته',
    levelsCap: 'سطوح کلیدی بیت‌کوین', high: 'سقف', low: 'کف', totalsCap: 'تصویر کلی بازار', totalCap: 'ارزش کل بازار', vol24: 'حجم ۲۴ ساعته', headline: 'تیتر دیشب',
    weekly: 'بررسی عمیق هفتگی', regimePath: 'مسیر رژیم در هفته', glanceCap: 'هفته در یک نگاه (۷ روزه)', allCoins: 'همه', allCoinsTail: 'کوین — عملکرد ۷ روزه',
    scorecardCap: '📋 کارنامه سناریوهای ما — این هفته', scCase: 'سناریو', scTrig: 'فعال شد', scFollow: 'ماندگاری', scHeld: 'حفظ شد',
    scorecardEmpty: '📋 کارنامه سناریوها: از این به بعد همه تحلیل‌های فلگ‌شیپ ثبت می‌شن — اولین هفته نمره‌دار جمعه آینده همین‌جا میاد.',
    aheadCap: 'تقویم پراثر هفته آینده', day: 'روز', event: 'رویداد', weeklyChartCap: 'برترین حرکت‌های هفته (۷ روزه %)',
    macroCal: 'تقویم اقتصادی', macroSub: 'فارکس‌فکتوری · همه ساعت‌ها به وقت تهران · 🔴 = اثر بالا', time: 'ساعت', forecast: 'پیش‌بینی', previous: 'قبلی', actual: 'واقعی',
    macroNone: 'امروز انتشار متوسط یا پراثری نداریم.', minor: 'انتشارهای کم‌اثر', nextHigh: 'پراثر بعدی',
    flash: 'فلش رویداد', watchTitle: 'زیر نظر: اقتصاد کلان', todayAt: 'امروز ساعت', highImpact: 'اثر بالا',
    watchText: 'عدد به‌زودی منتشر می‌شود — نتیجه و اثرش روی بازار چند دقیقه بعد همین‌جا می‌آید.',
    regimeNames: { RISK_ON: 'ریسک‌پذیر', RISK_OFF: 'ریسک‌گریز', RANGE: 'خنثی (رنج)', SQUEEZE_RISK: 'خطر اسکوئیز', CAPITULATION: 'تسلیم بازار', EUPHORIA: 'سرخوشی' },
    lean: { UP: 'صعودی', DOWN: 'نزولی', FLAT: 'خنثی' },
    fngNames: { extremeFear: 'ترس شدید', fear: 'ترس', neutral: 'خنثی', greed: 'طمع', extremeGreed: 'طمع شدید' },
  },
};

function L(lang) { return STR[lang] || STR.en; }
function footerClassic(lang) {
  return lang === 'fa'
    ? `<blockquote>📡 <b>TradeAgent IV</b> · <i>هوش مصنوعی بازار کریپتو</i>\n@TradeAgentIV</blockquote>`
    : `<blockquote>📡 <b>TradeAgent IV</b> · <i>AI Crypto Intelligence</i>\n@TradeAgentIV</blockquote>`;
}
function footerRich(lang) {
  return lang === 'fa'
    ? `<blockquote>📡 TradeAgent IV · هوش مصنوعی بازار کریپتو · @TradeAgentIV</blockquote>`
    : `<blockquote>📡 TradeAgent IV · AI Crypto Intelligence · @TradeAgentIV</blockquote>`;
}
function regimeName(label, lang) {
  if (lang === 'fa') return (STR.fa.regimeNames || {})[label] || label.replace(/_/g, ' ');
  return label.replace(/_/g, ' ');
}
function fngName(v, lang) {
  const n = L(lang).fngNames;
  if (v >= 75) return n.extremeGreed;
  if (v >= 55) return n.greed;
  if (v >= 45) return n.neutral;
  if (v >= 25) return n.fear;
  return n.extremeFear;
}
function biasText(v, lang) {
  if (lang === 'fa') {
    if (v >= 75) return '😱 طمع شدید — 🔴 احتیاط!';
    if (v >= 55) return '😊 طمع — 🟡 منطقه فومو';
    if (v >= 45) return '😐 خنثی — ⚪ متعادل';
    if (v >= 25) return '😰 ترس — 🟢 منطقه انباشت';
    return '😨 ترس شدید — 🟢 فرصت تاریخی!';
  }
  if (v >= 75) return '😱 Extreme Greed — 🔴 Caution!';
  if (v >= 55) return '😊 Greed — 🟡 FOMO Zone';
  if (v >= 45) return '😐 Neutral — ⚪ Balanced';
  if (v >= 25) return '😰 Fear — 🟢 Accumulation';
  return '😨 Extreme Fear — 🟢 Opportunity!';
}
function fngSignal(v, lang) {
  if (lang === 'fa') {
    if (v >= 75) return '⚠️ طمع شدید — سودگیری رو در نظر بگیرید.';
    if (v >= 55) return '📊 طمع دیده می‌شود — احتیاط کنید، منطقه فوموست.';
    if (v >= 45) return '⚖️ خنثی — منتظر حرکت جهت‌دار واضح بمانید.';
    if (v >= 25) return '💎 ترس در بازار — منطقه بالقوه انباشت.';
    return '🛡️ ترس شدید — از نظر تاریخی منطقه خرید.';
  }
  if (v >= 75) return '⚠️ Extreme greed — consider taking profits.';
  if (v >= 55) return '📊 Greed detected — caution advised, FOMO zone.';
  if (v >= 45) return '⚖️ Neutral — wait for clear directional move.';
  if (v >= 25) return '💎 Fear present — potential accumulation zone.';
  return '🛡️ Extreme fear — historical buying opportunity.';
}
function dateStr(lang, ts = Date.now()) {
  return new Date(ts).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' });
}
function timeStr(lang) {
  return lang === 'fa'
    ? new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tehran', hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const RLM = '\u200F';
export { STR, L, footerClassic, footerRich, regimeName, fngName, biasText, fngSignal, dateStr, timeStr, RLM };
