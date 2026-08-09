export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let code = req.query.code;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: '종목코드가 필요합니다.'
    });
  }

  code = decodeURIComponent(code).trim();

  try {
    const symbols = [`${code}.KS`, `${code}.KQ`];

    for (const symbol of symbols) {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const meta = data?.chart?.result?.[0]?.meta;

      if (meta?.regularMarketPrice) {
        return res.status(200).json({
          success: true,
          code,
          name: meta.shortName || symbol,
          price: Math.round(meta.regularMarketPrice)
        });
      }
    }

    return res.status(404).json({
      success: false,
      error: '종목을 찾을 수 없습니다.'
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
