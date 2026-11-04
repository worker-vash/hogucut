export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. 네이버 공식 쇼핑 검색 API (Open API) 지원 (하루 25,000건 무료, IP 차단 0%)
  const naverQuery = req.query.naverQuery;
  const clientId = process.env.NAVER_CLIENT_ID || req.query.clientId;
  const clientSecret = process.env.NAVER_CLIENT_SECRET || req.query.clientSecret;

  if (naverQuery && clientId && clientSecret) {
    try {
      const apiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(naverQuery)}&display=10&sort=sim`;
      const apiRes = await fetch(apiUrl, {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret
        }
      });
      const data = await apiRes.json();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 2. 일반 웹 URL 프록시
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const isAli = targetUrl.includes('aliexpress');
    const headers = {
      'User-Agent': isAli
        ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        : 'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': targetUrl.includes('naver') ? 'https://m.naver.com/' : 'https://www.google.com/'
    };

    const response = await fetch(targetUrl, { headers, redirect: 'follow' });
    const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(targetUrl)) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(Buffer.from(buffer));
    }

    const text = await response.text();
    return res.status(200).send(text);
  } catch (err) {
    return res.status(502).send(err.message);
  }
}
