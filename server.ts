import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch {
    return null;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readFirestoreString(field: Record<string, unknown> | undefined): string {
  if (!field) return '';
  if (typeof field.stringValue === 'string') return field.stringValue;
  return '';
}

function readFirestoreTimestamp(field: Record<string, unknown> | undefined): string {
  if (!field) return new Date().toUTCString();
  if (typeof field.timestampValue === 'string') {
    const d = new Date(field.timestampValue);
    return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
  }
  return new Date().toUTCString();
}

async function queryFirestorePublic(
  config: FirebaseAppletConfig,
  collectionId: string,
  fieldPath: string,
  value: string
): Promise<Array<Record<string, Record<string, unknown>>>> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    config.projectId
  )}/databases/${encodeURIComponent(config.firestoreDatabaseId)}/documents:runQuery`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: { stringValue: value },
          },
        },
        limit: 25,
      },
    }),
  });

  if (!response.ok) {
    return [];
  }

  const rows = (await response.json()) as Array<{
    document?: { fields?: Record<string, Record<string, unknown>> };
  }>;

  return rows
    .filter((row) => row.document && row.document.fields)
    .map((row) => row.document!.fields!);
}

async function getFirestorePublicPost(
  config: FirebaseAppletConfig,
  postId: string
): Promise<Record<string, Record<string, unknown>> | null> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(postId)) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    config.projectId
  )}/databases/${encodeURIComponent(config.firestoreDatabaseId)}/documents/posts/${encodeURIComponent(
    postId
  )}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const docData = (await response.json()) as {
      fields?: Record<string, Record<string, unknown>>;
    };
    if (!docData.fields) return null;
    if (readFirestoreString(docData.fields.status) !== 'published') return null;
    return docData.fields;
  } catch {
    return null;
  }
}

function wrapTextLines(input: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['Independent Essay on Folio'];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + (current ? ' ' : '') + word).length <= maxCharsPerLine) {
      current = current ? `${current} ${word}` : word;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxCharsPerLine - 3).trimEnd()}...`;
  }
  return lines;
}

function injectOpenGraphMeta(
  html: string,
  meta: { title: string; description: string; imageUrl: string; url: string }
): string {
  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeImg = escapeHtml(meta.imageUrl);
  const safeUrl = escapeHtml(meta.url);

  let updated = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    );

  const extraTags = `
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImg}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImg}" />
  </head>`;

  return updated.replace(/<\/head>/i, extraTags);
}

async function compileNewsletterEmailHtml(params: {
  publicationName?: string;
  publicationTagline?: string;
  accentColor?: string;
  authorName?: string;
  title?: string;
  subtitle?: string;
  contentMarkdown?: string;
  coverImageUrl?: string;
}): Promise<string> {
  const {
    publicationName = 'Folio Dispatch',
    publicationTagline = 'Independent Writing',
    accentColor = '#7C3AED',
    authorName = 'Editorial Team',
    title = 'Untitled Issue',
    subtitle = '',
    contentMarkdown = '',
    coverImageUrl = '',
  } = params;

  const safeAccent = /^#[0-9A-Fa-f]{6}$/.test(String(accentColor))
    ? String(accentColor)
    : '#7C3AED';

  const bodyHtml = await marked.parse(String(contentMarkdown || ''), {
    breaks: true,
    gfm: true,
  });

  const coverHtml = coverImageUrl
    ? `<img src="${escapeHtml(String(coverImageUrl))}" alt="${escapeHtml(
        String(title)
      )}" style="width:100%;max-height:340px;object-fit:cover;border-radius:8px;margin:20px 0;border:1px solid #272338;" />`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(String(title))}</title>
</head>
<body style="margin:0;padding:0;background-color:#09090D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F4F3F8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#09090D;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background-color:#14121D;border:1px solid #272338;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:28px 36px;border-bottom:1px solid #272338;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${safeAccent};font-weight:700;">
                ${escapeHtml(String(publicationName))}
              </div>
              <div style="font-size:13px;color:#A19BB5;margin-top:4px;">
                ${escapeHtml(String(publicationTagline))}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px;">
              <h1 style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:32px;line-height:1.2;color:#F4F3F8;">
                ${escapeHtml(String(title))}
              </h1>
              ${
                subtitle
                  ? `<p style="margin:0 0 20px 0;font-size:18px;line-height:1.5;color:#B8B4C7;">${escapeHtml(
                      String(subtitle)
                    )}</p>`
                  : ''
              }
              <div style="font-size:13px;color:#A19BB5;padding-bottom:20px;border-bottom:1px solid #272338;">
                By <strong style="color:#F4F3F8;">${escapeHtml(String(authorName))}</strong>
              </div>
              ${coverHtml}
              <div style="font-size:16px;line-height:1.75;color:#E4E1EF;margin-top:20px;">
                ${bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px;background-color:#0F0E15;border-top:1px solid #272338;font-size:12px;color:#86819A;">
              Published with Folio · You received this issue because you subscribed to ${escapeHtml(
                String(publicationName)
              )}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const firebaseConfig = loadFirebaseConfig();
  const uploadsDir = path.resolve(__dirname, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const TTS_VOICES = ['Kore', 'Charon', 'Puck', 'Fenrir', 'Zephyr'] as const;
  const ttsCache = new Map<string, string>();

  const getGeminiClient = (): GoogleGenAI | null => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  app.use(express.json({ limit: '4mb' }));
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'folio-editorial-server',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/tts/status', (_req, res) => {
    const available = Boolean(getGeminiClient());
    res.json({
      available,
      model: 'gemini-3.8-flash-lite-tts',
      voices: TTS_VOICES,
    });
  });

  app.post('/api/tts', async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Studio Voice requires a Gemini API key in Settings > Secrets. Switch to Device Voice below to listen using your browser voices.',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const { text, voice, style } = (req.body || {}) as {
        text?: string;
        voice?: string;
        style?: string;
      };
      const cleanText = typeof text === 'string' ? text.trim().slice(0, 2400) : '';
      if (!cleanText) {
        res.status(400).json({ error: 'Missing text to narrate.' });
        return;
      }

      const chosenVoice = TTS_VOICES.includes(voice as (typeof TTS_VOICES)[number])
        ? (voice as (typeof TTS_VOICES)[number])
        : 'Kore';
      const cleanStyle =
        typeof style === 'string' && style.trim().length > 0
          ? style.trim().slice(0, 120)
          : 'Warm, articulate literary essay narrator';

      const cacheKey = crypto
        .createHash('sha1')
        .update(`${chosenVoice}|${cleanStyle}|${cleanText}`)
        .digest('hex');

      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json({
          audioBase64: cached,
          mimeType: 'audio/wav',
          voice: chosenVoice,
          cached: true,
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: cleanStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: 'Voice model did not return audio data.' });
        return;
      }

      if (ttsCache.size >= 80) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        voice: chosenVoice,
        cached: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Voice generation failed.';
      const status = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')
        ? 429
        : msg.includes('403') || msg.includes('PERMISSION_DENIED')
        ? 403
        : 500;
      console.error('TTS generation error:', err);
      res.status(status).json({ error: msg });
    }
  });

  // Cover image upload endpoint (validates image MIME + <= 2MB, returns compact /uploads/... URL)
  app.post('/api/uploads/cover', (req, res) => {
    try {
      const { dataUrl } = (req.body || {}) as { dataUrl?: string };
      if (typeof dataUrl !== 'string') {
        res.status(400).json({ error: 'Missing image payload' });
        return;
      }
      const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        res.status(400).json({ error: 'Only PNG, JPEG, or WebP images are supported' });
        return;
      }
      const rawExt = match[1] === 'jpeg' ? 'jpg' : match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.byteLength === 0 || buffer.byteLength > 2 * 1024 * 1024) {
        res.status(413).json({ error: 'Cover image must be under 2 MB' });
        return;
      }
      const fileName = `cover_${Date.now().toString(36)}_${crypto
        .randomBytes(4)
        .toString('hex')}.${rawExt}`;
      const targetPath = path.join(uploadsDir, fileName);
      fs.writeFileSync(targetPath, buffer);
      res.json({
        url: `/uploads/${fileName}`,
        bytes: buffer.byteLength,
      });
    } catch (err) {
      console.error('Cover upload error:', err);
      res.status(500).json({ error: 'Failed to store uploaded cover image' });
    }
  });

  // Supporting membership checkout endpoint
  app.post('/api/membership/checkout', (req, res) => {
    try {
      const { publicationId, publicationName, plan } = (req.body || {}) as {
        publicationId?: string;
        publicationName?: string;
        plan?: 'monthly' | 'annual';
      };
      if (!publicationId || !publicationName) {
        res.status(400).json({ error: 'Missing publication details' });
        return;
      }
      const normalizedPlan = plan === 'annual' ? 'annual' : 'monthly';
      const amountUsd = normalizedPlan === 'annual' ? 70 : 7;
      res.json({
        receiptId: `folio_rcpt_${Date.now().toString(36)}_${crypto
          .randomBytes(3)
          .toString('hex')}`,
        publicationId,
        publicationName,
        plan: normalizedPlan,
        amountUsd,
        currency: 'USD',
        activatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Membership checkout error:', err);
      res.status(500).json({ error: 'Membership checkout failed' });
    }
  });

  // Dynamic OpenGraph editorial SVG card generator
  app.get('/api/og', async (req, res) => {
    try {
      const postId = typeof req.query.postId === 'string' ? req.query.postId.trim() : '';
      let title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
      let pubName = typeof req.query.pub === 'string' ? req.query.pub.trim() : '';
      let author = typeof req.query.author === 'string' ? req.query.author.trim() : '';
      let category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

      if (postId && firebaseConfig && (!title || !pubName)) {
        const fields = await getFirestorePublicPost(firebaseConfig, postId);
        if (fields) {
          title = title || readFirestoreString(fields.title);
          pubName = pubName || readFirestoreString(fields.publicationName);
          author = author || readFirestoreString(fields.authorName);
          category = category || readFirestoreString(fields.category);
        }
      }

      title = title || 'Folio — Independent Publishing & Essays';
      pubName = pubName || 'Folio Network';
      author = author || 'Independent Writers';
      category = category || 'Dispatches';

      const titleLines = wrapTextLines(title, 34, 3);
      const titleTspans = titleLines
        .map(
          (line, idx) =>
            `<tspan x="84" dy="${idx === 0 ? 0 : 62}">${escapeXml(line)}</tspan>`
        )
        .join('');

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#09090D"/>
  <rect x="40" y="40" width="1120" height="550" rx="20" fill="#14121D" stroke="#272338" stroke-width="2"/>
  <rect x="40" y="40" width="1120" height="8" rx="4" fill="#8B5CF6"/>
  <text x="84" y="128" fill="#A78BFA" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" letter-spacing="2">${escapeXml(
    pubName.toUpperCase()
  )} · ${escapeXml(category.toUpperCase())}</text>
  <text x="84" y="232" fill="#F4F3F8" font-family="Georgia, serif" font-size="52" font-weight="600">${titleTspans}</text>
  <line x1="84" y1="472" x2="1116" y2="472" stroke="#272338" stroke-width="1.5"/>
  <text x="84" y="530" fill="#D8D4E8" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500">By ${escapeXml(
    author
  )}</text>
  <text x="1116" y="530" text-anchor="end" fill="#C4B5FD" font-family="Georgia, serif" font-size="28" font-weight="700">Folio</text>
</svg>`;

      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(svg);
    } catch (err) {
      console.error('OG card generation error:', err);
      res.status(500).type('text/plain').send('Failed to generate OG image');
    }
  });

  // Dynamic RSS 2.0 feed for any publication hosted in Firestore
  app.get('/api/publications/:slug/rss.xml', async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`;

    if (!/^[a-z0-9-]+$/.test(slug)) {
      res.status(400).type('text/plain').send('Invalid publication slug');
      return;
    }

    try {
      let pubName = slug.replace(/-/g, ' ');
      let pubTagline = 'Independent publication on Folio';

      let itemsXml = '';
      if (firebaseConfig) {
        const pubs = await queryFirestorePublic(firebaseConfig, 'publications', 'slug', slug);
        if (pubs.length > 0) {
          pubName = readFirestoreString(pubs[0].name) || pubName;
          pubTagline = readFirestoreString(pubs[0].tagline) || pubTagline;
        }

        const posts = await queryFirestorePublic(firebaseConfig, 'posts', 'publicationSlug', slug);
        const publishedPosts = posts.filter(
          (fields) => readFirestoreString(fields.status) === 'published'
        );

        itemsXml = publishedPosts
          .map((fields) => {
            const id = readFirestoreString(fields.id);
            const title = readFirestoreString(fields.title);
            const subtitle = readFirestoreString(fields.subtitle);
            const excerpt = readFirestoreString(fields.excerpt);
            const authorName = readFirestoreString(fields.authorName);
            const pubDate = readFirestoreTimestamp(fields.publishedAt || fields.createdAt);
            const link = `${baseUrl}/?post=${encodeURIComponent(id)}`;
            return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(id)}</guid>
      <author>${escapeXml(authorName)}</author>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>${escapeXml(subtitle || excerpt)}</description>
    </item>`;
          })
          .join('\n');
      }

      const feedUrl = `${baseUrl}/api/publications/${encodeURIComponent(slug)}/rss.xml`;
      const pubUrl = `${baseUrl}/?pub=${encodeURIComponent(slug)}`;

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(pubName)}</title>
    <link>${escapeXml(pubUrl)}</link>
    <description>${escapeXml(pubTagline)}</description>
    <language>en-us</language>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      res.send(xml);
    } catch (err) {
      console.error('RSS generation error:', err);
      res.status(500).type('text/plain').send('Failed to generate RSS feed');
    }
  });

  // Server-side newsletter email HTML compiler for writer preview & export
  app.post('/api/newsletter/preview', async (req, res) => {
    try {
      const emailHtml = await compileNewsletterEmailHtml(req.body || {});
      res.json({ html: emailHtml });
    } catch (err) {
      console.error('Newsletter preview error:', err);
      res.status(500).json({ error: 'Failed to compile newsletter HTML' });
    }
  });

  // Server-side newsletter dispatch endpoint compiling issue digest and returning delivery summary
  app.post('/api/newsletter/send', async (req, res) => {
    try {
      const body = req.body || {};
      const subscriberCount = Number(body.subscriberCount || 0);
      const emailHtml = await compileNewsletterEmailHtml(body);
      res.json({
        dispatched: true,
        messageId: `folio_msg_${Date.now().toString(36)}`,
        recipientCount: Math.max(0, subscriberCount),
        sentAt: new Date().toISOString(),
        htmlBytes: Buffer.byteLength(emailHtml, 'utf8'),
        html: emailHtml,
      });
    } catch (err) {
      console.error('Newsletter dispatch error:', err);
      res.status(500).json({ error: 'Failed to dispatch newsletter' });
    }
  });

  const buildPostMeta = async (req: express.Request, postId: string) => {
    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    let title = 'Folio Essay — Independent Publishing';
    let description =
      'Read long-form essays and subscriber newsletters on Folio.';
    let imageUrl = `${baseUrl}/api/og?postId=${encodeURIComponent(postId)}`;

    if (firebaseConfig) {
      const fields = await getFirestorePublicPost(firebaseConfig, postId);
      if (fields) {
        const postTitle = readFirestoreString(fields.title);
        const pubName = readFirestoreString(fields.publicationName);
        const subtitle = readFirestoreString(fields.subtitle);
        const excerpt = readFirestoreString(fields.excerpt);
        if (postTitle) {
          title = pubName ? `${postTitle} — ${pubName}` : postTitle;
        }
        if (subtitle || excerpt) {
          description = subtitle || excerpt;
        }
      }
    }

    return {
      title,
      description,
      imageUrl,
      url: `${baseUrl}/?post=${encodeURIComponent(postId)}`,
    };
  };

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get('/', async (req, res, next) => {
      const postId = typeof req.query.post === 'string' ? req.query.post.trim() : '';
      if (!postId) {
        next();
        return;
      }
      try {
        const rawHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const meta = await buildPostMeta(req, postId);
        const transformed = await vite.transformIndexHtml(
          req.originalUrl,
          injectOpenGraphMeta(rawHtml, meta)
        );
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch {
        next();
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', async (req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      const postId = typeof req.query.post === 'string' ? req.query.post.trim() : '';
      if (postId && fs.existsSync(indexPath)) {
        try {
          const rawHtml = fs.readFileSync(indexPath, 'utf-8');
          const meta = await buildPostMeta(req, postId);
          res.status(200).set({ 'Content-Type': 'text/html' }).send(injectOpenGraphMeta(rawHtml, meta));
          return;
        } catch {
          // Fall through to default file
        }
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Folio server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
