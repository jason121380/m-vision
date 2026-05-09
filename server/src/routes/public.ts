import { Hono } from 'hono';
import { z } from 'zod';
import { read, update, dataDir } from '../store/storage.ts';

export const publicRoutes = new Hono();

publicRoutes.get('/config', async (c) => {
  const d = await read();
  return c.json({
    services: d.services,
    cameras: d.cameras,
    ceremonies: d.ceremonies,
    addons: d.addons,
    photographers: d.photographers,
    settings: d.settings,
    bookings: d.bookings,
  });
});

const submissionSchema = z.object({
  submittedAt: z.string().optional(),
  groom: z.string(),
  bride: z.string(),
  phone: z.string(),
  eventDate: z.string(),
  service: z.string(),
  weddingTime: z.string().optional().default(''),
  restaurant: z.string().optional().default(''),
  hotel: z.string().optional().default(''),
  cerWz: z.string().optional().default(''),
  cerYq: z.string().optional().default(''),
  cerZh: z.string().optional().default(''),
  makeupTime: z.string().optional().default(''),
  total: z.number(),
  breakdown: z.string().optional().default(''),
  signature: z.string().optional().default(''),
  pdfBase64: z.string().optional().default(''),
  pdfFilename: z.string().optional().default(''),
  svc: z.enum(['video', 'photo', 'both']),
  vpKey: z.string().optional().default(''),
  ppKey: z.string().optional().default(''),
  vCams: z.number().optional().default(0),
  pCams: z.number().optional().default(0),
});

publicRoutes.post('/booking', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  const data = parsed.data;

  // 1. PDF 上傳到 Drive（透過現有 Apps Script），server 不存 PDF
  let pdfUrl = '';
  if (!data.pdfBase64) {
    console.warn('[booking] no pdfBase64 in payload, skipping PDF upload');
  } else if (!process.env.PDF_UPLOAD_ENDPOINT) {
    console.warn('[booking] PDF_UPLOAD_ENDPOINT not set, skipping PDF upload');
  } else {
    try {
      const res = await fetch(process.env.PDF_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          pdfBase64: data.pdfBase64,
          pdfFilename: data.pdfFilename,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { pdfUrl?: string; ok?: boolean; error?: string }
        | null;
      if (json?.pdfUrl) {
        pdfUrl = json.pdfUrl;
        console.info('[booking] PDF uploaded:', pdfUrl);
      } else {
        console.warn('[booking] PDF upload returned no url, body=', json);
      }
    } catch (err) {
      console.warn('[booking] PDF upload threw:', err);
    }
  }

  await update((d) => {
    // 2. 寫 submissions
    const id = d.nextSubmissionId++;
    d.submissions.unshift({
      id,
      submittedAt: data.submittedAt || new Date().toISOString(),
      groom: data.groom,
      bride: data.bride,
      phone: data.phone,
      eventDate: data.eventDate,
      service: data.service,
      weddingTime: data.weddingTime,
      restaurant: data.restaurant,
      hotel: data.hotel,
      cerWz: data.cerWz,
      cerYq: data.cerYq,
      cerZh: data.cerZh,
      makeupTime: data.makeupTime,
      total: data.total,
      breakdown: data.breakdown,
      signature: data.signature,
      pdfUrl,
      raw: data,
    });

    // 3. 累加 bookings
    const addV = data.svc === 'video' || data.svc === 'both';
    const addP = data.svc === 'photo' || data.svc === 'both';
    const vKey = data.vpKey === 'any' ? '' : data.vpKey;
    const pKey = data.ppKey === 'any' ? '' : data.ppKey;

    let bk = d.bookings.find((b) => b.date === data.eventDate);
    if (!bk) {
      bk = {
        date: data.eventDate,
        videoSlots: 0,
        photoSlots: 0,
        videoCamsUsed: 0,
        photoCamsUsed: 0,
        videoLeads: [],
        photoLeads: [],
        notes: '',
      };
      d.bookings.push(bk);
    }
    if (addV) {
      bk.videoSlots += 1;
      bk.videoCamsUsed += data.vCams;
      if (vKey && !bk.videoLeads.includes(vKey)) bk.videoLeads.push(vKey);
    }
    if (addP) {
      bk.photoSlots += 1;
      bk.photoCamsUsed += data.pCams;
      if (pKey && !bk.photoLeads.includes(pKey)) bk.photoLeads.push(pKey);
    }
    d.bookings.sort((a, b) => a.date.localeCompare(b.date));
  });

  return c.json({ ok: true, pdfUrl });
});

publicRoutes.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));
publicRoutes.get('/_count', async (c) => {
  const d = await read();
  return c.json({
    services: d.services.length,
    bookings: d.bookings.length,
    submissions: d.submissions.length,
    photographers: d.photographers.length,
    dataDir: dataDir(),
  });
});
