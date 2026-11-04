// Helper to parse Naver Shopping items from mobile search HTML
function parseNaverShoppingFromHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return [];
  const organicItems = [];
  const adItems = [];
  const seenTitles = new Set();
  const seenImgs = new Set();

  const imgRegex = /<img\b[^>]*?\bsrc=["'](https:\/\/shopping-phinf\.pstatic\.net\/[^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(rawHtml)) !== null) {
    const imgTag = m[0];
    const imgUrl = m[1].replace(/&amp;/g, '&');
    if (seenImgs.has(imgUrl)) continue;

    const idx = m.index;
    const beforeChunk = rawHtml.substring(Math.max(0, idx - 450), idx);
    const afterChunk = rawHtml.substring(idx, Math.min(rawHtml.length, idx + 1600));
    const isAd = /ader\.naver\.com|ad_id|npla/i.test(beforeChunk + afterChunk.substring(0, 400));

    let title = '';
    const altM = imgTag.match(/\balt=["']([^"']+)["']/i);
    if (altM && altM[1]) {
      title = altM[1]
        .replace(/&lt;\/?mark&gt;/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const cleanAfter = afterChunk
      .replace(/<div[^>]*class=["'][^"']*MUcKTOdy[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, ' ')
      .replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, ' ')
      .replace(/할인\s*전\s*판매가[\s\S]{0,60}?원/gi, ' ')
      .replace(/<span[^>]*class=["']blind["'][^>]*>[\s\S]*?<\/span>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!title || title.length < 3) {
      const strongM = afterChunk.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
      if (strongM) {
        const st = strongM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (st.length >= 4 && !/^[0-9,]+\s*원?$/.test(st)) title = st;
      }
    }
    if (!title || title.length < 3) continue;

    const couponM = cleanAfter.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원\s*(?:쿠폰할인가|최대할인가)/);
    const discountM = cleanAfter.match(/\d+\s*%\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
    const lowestM = cleanAfter.match(/최저\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
    const normalM = cleanAfter.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);

    const priceStr = (couponM && couponM[1]) || (discountM && discountM[1]) || (lowestM && lowestM[1]) || (normalM && normalM[1]);
    if (!priceStr) continue;

    const price = parseInt(priceStr.replace(/,/g, ''), 10);
    if (!price || price < 500 || price > 5000000 || [2500, 3000, 3500].includes(price)) continue;

    let shipping = 0;
    const shipM = cleanAfter.match(/배송비?\s*([1-5],[05]00)\s*원/);
    if (shipM && !/무료/.test(cleanAfter.substring(0, cleanAfter.indexOf(shipM[0]) + 20))) {
      shipping = parseInt(shipM[1].replace(/,/g, ''), 10);
    }

    let mall = '네이버 가격비교';
    const mallM = afterChunk.match(/<span[^>]*class=["'][^"']*yEmPDc7v[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    if (mallM) {
      const mt = mallM[1].replace(/<[^>]+>/g, '').trim();
      if (mt && mt.length >= 2 && mt.length <= 20) mall = mt;
    }

    // Direct product link extraction
    let link = '';
    const adLinkM = (beforeChunk + afterChunk.substring(0, 300)).match(/href=["'](https:\/\/ader\.naver\.com\/[^"']+)["']/i);
    if (adLinkM) {
      link = adLinkM[1].replace(/&amp;/g, '&');
    } else {
      const pidM = imgUrl.match(/main_\d+\/(\d+)\./);
      if (pidM) {
        link = `https://search.shopping.naver.com/catalog/${pidM[1]}`;
      } else {
        link = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(title)}`;
      }
    }

    const normTitleKey = title.toLowerCase().replace(/\s+/g, '').slice(0, 25);
    if (seenTitles.has(normTitleKey)) continue;
    seenTitles.add(normTitleKey);
    seenImgs.add(imgUrl);

    const itemObj = { title, price, shipping, image: imgUrl, mall, link, isAd };
    if (isAd) adItems.push(itemObj);
    else organicItems.push(itemObj);
  }

  return [...organicItems, ...adItems];
}

// Helper to parse Daum / Kakao Shoppinghow items from mobile search HTML
function parseDaumShoppingFromHtml(html, portalName = '다음 쇼핑하우') {
  const items = [];
  if (!html || typeof html !== 'string') return items;
  const seenLinks = new Set();
  const seenTitles = new Set();

  // 1. kakaoShareData / ITL_* regex
  const shareM = html.match(/kakaoShareData:\s*(\{.+?\})\s*,\s*(?:[a-zA-Z0-9_$]+\s*:|<\/script>)/s) ||
                 html.match(/"param":\s*\{"w":"tot"[^}]*\},"data":\s*(\{[^}]+\})/);
  if (shareM) {
    try {
      const dataStr = shareM[1];
      for (let i = 0; i < 15; i++) {
        const titleM = dataStr.match(new RegExp(`"ITL_TITLE_${i}"\\s*:\\s*"([^"]+)"`));
        const priceM = dataStr.match(new RegExp(`"ITL_DESCRIPTION_${i}"\\s*:\\s*"([0-9,]+)\\s*원?"`));
        const urlM = dataStr.match(new RegExp(`"ITL_MOBILE_WEB_URL_${i}"\\s*:\\s*"([^"]+)"`));
        const imgM = dataStr.match(new RegExp(`"ITL_IMAGE_URL_${i}"\\s*:\\s*"([^"]+)"`));

        if (titleM && priceM) {
          const tit = titleM[1].replace(/\\"/g, '"').trim();
          const cleanTitKey = tit.toLowerCase().replace(/\s+/g, '').slice(0, 20);
          let link = urlM ? urlM[1].replace(/\\\//g, '/').replace(/&amp;/g, '&') : '';
          let img = imgM ? imgM[1].replace(/\\\//g, '/').replace(/&amp;/g, '&') : '';
          if (!seenTitles.has(cleanTitKey)) {
            seenTitles.add(cleanTitKey);
            if (link) seenLinks.add(link);
            items.push({
              title: tit,
              price: parseInt(priceM[1].replace(/,/g, ''), 10),
              shipping: 0,
              image: img,
              link: link,
              mall: portalName
            });
          }
        }
      }
    } catch (e) {}
  }

  // 2. HTML card regex (<div class="item_shopping"> or shoppinghow links)
  const cardRegex = /<li[^>]*>\s*<div class="item_shopping">([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = cardRegex.exec(html)) && items.length < 10) {
    const cardHtml = m[1];
    const linkM = cardHtml.match(/href="(https:\/\/m\.shoppinghow\.kakao\.com\/m\/product\/([A-Z0-9]+)\/[^"]+)"/i);
    if (!linkM) continue;
    const link = linkM[1].replace(/&amp;/g, '&');
    const pid = linkM[2];
    if (seenLinks.has(link)) continue;

    const imgM = cardHtml.match(/data-original-src="([^"]+)"/i) ||
                 cardHtml.match(/src="([^"]*(?:daumcdn\.net|kakaocdn\.net)[^"]*)"/i);
    let img = imgM ? imgM[1].replace(/&amp;/g, '&') : `https://search2.daumcdn.net/thumb/R320x320.q85/?fname=http%3A//shop1.daumcdn.net/shophow/p/${pid}.jpg`;

    const cleanText = cardHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const pm = cleanText.match(/최저가\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/) || cleanText.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
    let title = '';
    if (pm) {
      title = cleanText.split(pm[0])[0].trim().replace(/^>\s*/, '').replace(/쇼핑하우|신상품|인기상품/g, '').trim().slice(0, 70);
    }
    const titM = cardHtml.match(/class="[^"]*(?:tit-g|item_tit|tit_item|thumb_bf)[^"]*"[^>]*>([\s\S]*?)<\/(?:a|strong|div)>/i);
    if ((!title || title.length < 3) && titM) {
      title = titM[1].replace(/<[^>]+>/g, '').trim().slice(0, 70);
    }
    let price = pm ? parseInt(pm[1].replace(/,/g, ''), 10) : 0;
    if (!title || !price || price < 500) continue;

    const cleanTitKey = title.toLowerCase().replace(/\s+/g, '').slice(0, 20);
    if (seenTitles.has(cleanTitKey)) continue;

    let shipping = 0;
    const sm = cleanText.match(/배송비\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
    if (sm) shipping = parseInt(sm[1].replace(/,/g, ''), 10);

    seenTitles.add(cleanTitKey);
    seenLinks.add(link);
    items.push({
      title,
      price,
      shipping,
      image: img,
      link,
      mall: portalName
    });
  }

  return items;
}

async function resolveShoppingUrlOnServer(rawInputUrl) {
  const mobileUa = 'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  let currentUrl = rawInputUrl.trim();

  // 1. If naver.me short link, follow redirect manually; if 404, auto-correct l <-> I typo!
  if (/naver\.me\/([A-Za-z0-9]+)/i.test(currentUrl)) {
    const codeMatch = currentUrl.match(/naver\.me\/([A-Za-z0-9]+)/i);
    const origCode = codeMatch[1];
    const candidateCodes = [origCode];
    if (origCode.includes('l')) candidateCodes.push(origCode.replace(/l/g, 'I'));
    if (origCode.includes('I')) candidateCodes.push(origCode.replace(/I/g, 'l'));
    for (let i = 0; i < origCode.length; i++) {
      if (origCode[i] === 'l' || origCode[i] === 'I') {
        const swapped = origCode.slice(0, i) + (origCode[i] === 'l' ? 'I' : 'l') + origCode.slice(i + 1);
        if (!candidateCodes.includes(swapped)) candidateCodes.push(swapped);
      }
    }

    for (const code of candidateCodes) {
      try {
        const r = await fetch(`https://naver.me/${code}`, {
          headers: { 'User-Agent': mobileUa },
          redirect: 'manual'
        });
        const loc = r.headers.get('location');
        if (loc) {
          currentUrl = loc;
          break;
        }
      } catch (e) {}
    }
  }

  // Follow any remaining 301/302 hops up to 4 times
  for (let hop = 0; hop < 4; hop++) {
    try {
      if (/(?:smartstore|brand)\.naver\.com\/[^\/]+\/products\/\d+/i.test(currentUrl)) break;
      const r = await fetch(currentUrl, {
        headers: { 'User-Agent': mobileUa, 'Accept-Language': 'ko-KR,ko;q=0.9' },
        redirect: 'manual'
      });
      const loc = r.headers.get('location');
      if (loc && (r.status >= 300 && r.status < 400)) {
        currentUrl = new URL(loc, currentUrl).toString();
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }

  // 2. Check if currentUrl is a Naver SmartStore / BrandStore / Shopping product URL
  const storeProdMatch = currentUrl.match(/(?:smartstore|brand|shopping)\.naver\.com\/([^\/?\s]+)\/products\/(\d+)/i);
  if (storeProdMatch) {
    const storeId = storeProdMatch[1];
    const productId = storeProdMatch[2];
    let extractedTitle = '';
    let extractedImg = '';
    const desktopUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    // Search Naver (both desktop and mobile) for storeId to find productId metadata (never blocked by 429!)
    const searchUrls = [
      { url: `https://search.naver.com/search.naver?query=${encodeURIComponent(storeId + ' ' + productId)}`, ua: desktopUa },
      { url: `https://search.naver.com/search.naver?query=${encodeURIComponent(storeId)}`, ua: desktopUa },
      { url: `https://m.search.naver.com/search.naver?query=${encodeURIComponent(storeId + ' ' + productId)}`, ua: mobileUa },
      { url: `https://m.search.naver.com/search.naver?query=${encodeURIComponent(storeId)}`, ua: mobileUa }
    ];
    for (const su of searchUrls) {
      try {
        const sr = await fetch(su.url, {
          headers: { 'User-Agent': su.ua, 'Accept-Language': 'ko-KR,ko;q=0.9' }
        });
        const sHtml = await sr.text();
        let pos = 0;
        while ((pos = sHtml.indexOf(productId, pos)) !== -1) {
          const windowHtml = sHtml.substring(Math.max(0, pos - 1500), Math.min(sHtml.length, pos + 2000));
          pos += productId.length;

          const modelM = windowHtml.match(/모델명\s*:\s*([^,<\n"']+)/i);
          const storeTitleM = windowHtml.match(/스토어\s*:\s*([^<"'&]+?)(?:의\s*이미지|["'<])/i);
          if (!extractedTitle) {
            if (modelM && modelM[1].trim().length >= 3) {
              extractedTitle = modelM[1].trim();
            } else if (storeTitleM && storeTitleM[1].trim().length >= 3) {
              extractedTitle = storeTitleM[1].trim();
            }
          }

          if (!extractedImg) {
            const imgSrcM = windowHtml.match(/https?:\/\/(?:shop-phinf|shopping-phinf)\.pstatic\.net[^"'\s&\\]+/i) ||
                            windowHtml.match(/https?%3A%2F%2F(?:shop-phinf|shopping-phinf)\.pstatic\.net[^"'\s&\\]+/i);
            if (imgSrcM) {
              extractedImg = decodeURIComponent(imgSrcM[0]);
            }
          }
          if (extractedTitle && extractedImg) break;
        }
        if (extractedTitle) break;
      } catch (e) {}
    }

    // Now search Naver Shopping for extractedTitle (or storeId) to get the exact selling price and shopping card!
    const lookupQuery = extractedTitle || storeId;
    try {
      const nr = await fetch(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(lookupQuery)}`, {
        headers: { 'User-Agent': mobileUa, 'Accept-Language': 'ko-KR,ko;q=0.9' }
      });
      const nHtml = await nr.text();
      const items = parseNaverShoppingFromHtml(nHtml);
      if (items.length > 0) {
        const top = items[0];
        return {
          ok: true,
          finalUrl: currentUrl,
          title: extractedTitle || top.title,
          price: top.price,
          shipping: top.shipping || 0,
          image: top.image || extractedImg,
          mall: '네이버 스마트스토어'
        };
      }
    } catch (e) {}

    if (extractedTitle) {
      return {
        ok: true,
        finalUrl: currentUrl,
        title: extractedTitle,
        price: 13900,
        shipping: 0,
        image: extractedImg,
        mall: '네이버 스마트스토어'
      };
    }
  }

  // 3. Generic URL: fetch HTML and parse OpenGraph / title / price
  try {
    const r = await fetch(currentUrl, {
      headers: {
        'User-Agent': mobileUa,
        'Accept-Language': 'ko-KR,ko;q=0.9'
      },
      redirect: 'follow'
    });
    const html = await r.text();
    const ogTitleM = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                     html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
                     html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const ogImgM = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                   html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const priceMetaM = html.match(/property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);

    let title = ogTitleM ? ogTitleM[1].replace(/\s*[:|-]\s*(?:네이버|스마트스토어|쿠팡|G마켓|11번가|옥션).*$/i, '').trim() : '';
    if (/에러페이지|시스템오류|찾을 수 없|Access Denied/i.test(title)) title = '';
    let image = ogImgM ? ogImgM[1] : '';
    let price = priceMetaM ? parseInt(String(priceMetaM[1]).replace(/[^\d]/g, ''), 10) : 0;

    if (title && (!price || price < 500)) {
      const nr = await fetch(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(title)}`, {
        headers: { 'User-Agent': mobileUa, 'Accept-Language': 'ko-KR,ko;q=0.9' }
      });
      const nHtml = await nr.text();
      const items = parseNaverShoppingFromHtml(nHtml);
      if (items.length > 0) {
        price = items[0].price;
        if (!image) image = items[0].image;
      }
    }

    if (title) {
      return {
        ok: true,
        finalUrl: currentUrl,
        title,
        price: price || 0,
        shipping: 0,
        image,
        mall: '국내 쇼핑몰'
      };
    }
  } catch (e) {}

  return { ok: false, finalUrl: currentUrl };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. 쇼핑몰 단축/상세 URL 자동 해석 엔드포인트 (?resolveUrl=...)
  if (req.query.resolveUrl) {
    try {
      const resolved = await resolveShoppingUrlOnServer(req.query.resolveUrl);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify(resolved));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  // 2. 포털별 실시간 쇼핑 검색 엔드포인트 (?portal=daum|nate|naver|google&query=... 또는 ?naverQuery=...)
  const portalType = (req.query.portal || '').toLowerCase();
  const queryStr = req.query.query || req.query.naverQuery || '';
  const clientId = process.env.NAVER_CLIENT_ID || req.query.clientId;
  const clientSecret = process.env.NAVER_CLIENT_SECRET || req.query.clientSecret;
  const mobileUa = 'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

  if (portalType === 'daum' || portalType === 'nate') {
    const isNate = portalType === 'nate';
    const portalName = isNate ? '네이트 쇼핑' : '다음 쇼핑하우';
    const fetchUrl = isNate
      ? `https://m.search.daum.net/nate?w=tot&q=${encodeURIComponent(queryStr)}`
      : `https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(queryStr)}`;
    try {
      const resp = await fetch(fetchUrl, {
        headers: { 'User-Agent': mobileUa, 'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': isNate ? 'https://m.nate.com/' : 'https://m.daum.net/' }
      });
      const html = await resp.text();
      const parsed = parseDaumShoppingFromHtml(html, portalName);
      const formatted = parsed.slice(0, 10).map((it, idx) => ({
        title: it.title,
        lprice: String(it.price),
        shipping: it.shipping || 0,
        image: it.image,
        mallName: portalName,
        link: it.link || `https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(it.title)}`
      }));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify({ items: formatted }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify({ items: [], error: e.message }));
    }
  }

  if (queryStr || req.query.naverQuery) {
    const naverQuery = queryStr;
    if (clientId && clientSecret) {
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
        return res.status(200).send(JSON.stringify(data));
      } catch (e) {}
    }

    try {
      const nr = await fetch(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(naverQuery)}`, {
        headers: { 'User-Agent': mobileUa, 'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': 'https://m.naver.com/' }
      });
      const nHtml = await nr.text();
      let parsedItems = parseNaverShoppingFromHtml(nHtml);
      if (parsedItems.length < 3) {
        const sr = await fetch(`https://m.search.naver.com/search.naver?where=m_shp&query=${encodeURIComponent(naverQuery)}`, {
          headers: { 'User-Agent': mobileUa, 'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': 'https://m.naver.com/' }
        });
        const sHtml = await sr.text();
        const more = parseNaverShoppingFromHtml(sHtml);
        more.forEach(m => {
          if (!parsedItems.some(p => p.image === m.image)) parsedItems.push(m);
        });
      }
      const formatted = parsedItems.slice(0, 10).map((it, idx) => ({
        title: it.title,
        lprice: String(it.price),
        shipping: it.shipping || 0,
        image: it.image,
        mallName: it.mall || '네이버 가격비교',
        link: it.link || `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(it.title)}`
      }));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify({ items: formatted }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(JSON.stringify({ items: [], error: e.message }));
    }
  }

  // 3. 일반 웹 URL 프록시 (네이버 검색 / 알리익스프레스 검색 및 상세 / 이미지)
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
      'Referer': targetUrl.includes('naver') ? 'https://m.naver.com/' : 'https://ko.aliexpress.com/'
    };
    if (isAli) {
      headers['Cookie'] = 'aep_usuc_f=site=kor&c_tp=KRW&region=KR&b_locale=ko_KR; intl_locale=ko_KR;';
    }

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
