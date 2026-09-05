import { Recipe, Tweak } from './types';
import { v4 as uuid } from 'uuid';

export async function scrapeRecipe(url: string): Promise<{ original: Recipe; tweaks: Tweak[] }> {
  const { chromium } = await import('playwright-extra');
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;

  chromium.use(StealthPlugin());

  const browser = await chromium.launch({
    headless: true,
    // NOTE: this is a single static Webshare proxy IP. If scraping starts
    // timing out again, check your Webshare dashboard first -- free-plan
    // proxies get rotated/replaced periodically.
    proxy:
      process.env.WEBSHARE_USER && process.env.PROXY_SERVER
        ? {
            server: process.env.PROXY_SERVER,
            username: process.env.WEBSHARE_USER,
            password: process.env.WEBSHARE_PASS,
          }
        : undefined,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Skip images/fonts/media to cut bandwidth usage (matters a lot on a
    // limited proxy plan) -- we only need the HTML content.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      const clean = (text: string | null | undefined) => {
        if (!text) return '';
        return text
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Strip author name, dates, and site UI chrome from raw review text
      const cleanTweakText = (raw: string, author: string) => {
        let t = raw;

        if (author && author !== 'Anonymous' && t.startsWith(author)) {
          t = t.slice(author.length);
        }

        t = t.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}/, '');
        t = t.replace(/^[A-Z][a-z]+\s\d{1,2},\s\d{4}/, '');
        t = t.replace(/Read More/gi, '');
        t = t.replace(/\d+\s*Repl(y|ies)/gi, '');
        t = t.replace(/Helpful\?/gi, '');

        return t.replace(/\s+/g, ' ').trim();
      };

      const title = clean(document.querySelector('h1')?.textContent) || 'Untitled Recipe';

      // ===== INGREDIENTS =====
      let ingredients: string[] = [];

      const ingredientSelectors = [
        '.mntl-structured-ingredients__list-item',
        '[class*="structured-ingredients"] li',
        '[itemprop="recipeIngredient"]',
        '.ingredients-item-name',
        '.recipe-ingredients li',
      ];

      for (const selector of ingredientSelectors) {
        const els = document.querySelectorAll(selector);
        if (els.length > 2) {
          ingredients = Array.from(els)
            .map((el) => clean(el.textContent))
            .filter((t) => t.length > 2 && t.length < 140);
          break;
        }
      }

      // ===== INSTRUCTIONS =====
      let instructions: string[] = [];

      const instructionSelectors = [
        '.mntl-sc-block-group--OL li',
        '[class*="sc-block-group--OL"] li',
        '.mntl-sc-block-group--P p',
        '.mntl-sc-block-group--P .mntl-sc-block-html',
        '[class*="instruction"] li',
        '[class*="instruction"] p',
        '[itemprop="recipeInstructions"] li',
        '[itemprop="recipeInstructions"] p',
        '.recipe-directions__list--item',
        '.directions-section li',
      ];

      for (const selector of instructionSelectors) {
        const els = document.querySelectorAll(selector);
        if (els.length > 0) {
          instructions = Array.from(els)
            .map((el) => clean(el.textContent))
            .filter((t) => t.length > 20 && !t.includes('http') && !t.includes('src='));
          if (instructions.length > 0) break;
        }
      }

      // ===== FEATURED TWEAKS =====
      const tweakEls = document.querySelectorAll(
        '[class*="review-card"], [class*="feedback"], [class*="ugc-review"], [class*="review"]'
      );

      const tweaksRaw: { author: string; text: string }[] = [];

      tweakEls.forEach((el) => {
        let author = 'Anonymous';
        const authorEl = el.querySelector(
          '[class*="author"], [class*="name"], [class*="username"], [class*="user-name"]'
        );
        if (authorEl) {
          author = clean(authorEl.textContent).replace(/^by\s+/i, '') || 'Anonymous';
        }

        // No real author found almost always means this matched element is
        // page chrome (rating summary, section heading, the recipe title
        // itself) rather than an actual review -- skip it.
        if (author === 'Anonymous') return;

        const bodyEl = el.querySelector(
          '[class*="feedback-body"], [class*="review-text"], [class*="ugc-review-body"], p'
        );
        const rawText = bodyEl ? clean(bodyEl.textContent) : clean(el.textContent);
        const text = cleanTweakText(rawText, author);

        if (text.length < 20 || text.length > 900) return;

        const lower = text.toLowerCase();
        if (
          lower.includes('ingredients') ||
          lower.includes('directions') ||
          lower.includes('nutrition') ||
          lower.includes('ask the community')
        ) {
          return;
        }

        tweaksRaw.push({ author, text });
      });

      const uniqueTweaks = tweaksRaw.filter(
        (t, i, self) => i === self.findIndex((x) => x.text.slice(0, 70) === t.text.slice(0, 70))
      );

      return {
        title,
        ingredients: Array.from(new Set(ingredients)).slice(0, 25),
        instructions: Array.from(new Set(instructions)).slice(0, 15),
        tweaksRaw: uniqueTweaks.slice(0, 12),
      };
    });

    const tweaks: Tweak[] = data.tweaksRaw.map((t) => ({
      id: uuid(),
      author: t.author || 'Anonymous',
      text: t.text,
    }));

    return {
      original: {
        title: data.title,
        ingredients:
          data.ingredients.length > 0
            ? data.ingredients
            : ['(Could not extract ingredients cleanly)'],
        instructions:
          data.instructions.length > 0
            ? data.instructions
            : ['(Could not extract instructions cleanly)'],
        url,
      },
      tweaks,
    };
  } finally {
    await browser.close();
  }
}