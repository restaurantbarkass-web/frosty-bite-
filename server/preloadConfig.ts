import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Preload configuration for critical application assets.
 * Used by Express server to output HTTP `Link` preload headers, 
 * minimizing network round-trip time (RTT) for initial page loads.
 */
export interface PreloadConfig {
  fonts: Array<{ url: string; crossOrigin?: boolean }>;
  preconnectDomains: string[];
  staticImages: string[];
  enableDynamicAssetScanning: boolean;
}

export const PRELOAD_CONFIG: PreloadConfig = {
  preconnectDomains: [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
  ],
  fonts: [
    {
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Archivo+Black&display=swap',
    }
  ],
  staticImages: [
    '/logo_192.png',
    '/logo_512.png'
  ],
  enableDynamicAssetScanning: true
};

/**
 * Builds HTTP `Link` header string based on configuration and dist folder assets.
 */
export function buildPreloadHeaderString(distPath?: string): string {
  const linkDirectives: string[] = [];

  // Preconnect directives
  PRELOAD_CONFIG.preconnectDomains.forEach(domain => {
    linkDirectives.push(`<${domain}>; rel=preconnect; crossorigin`);
  });

  // Critical font directives
  PRELOAD_CONFIG.fonts.forEach(font => {
    linkDirectives.push(`<${font.url}>; rel=preload; as=style`);
  });

  // Critical images
  PRELOAD_CONFIG.staticImages.forEach(img => {
    linkDirectives.push(`<${img}>; rel=preload; as=image`);
  });

  // Dynamic asset scanning from production build dist/index.html (ONLY in production mode)
  if (PRELOAD_CONFIG.enableDynamicAssetScanning && distPath && process.env.NODE_ENV === 'production') {
    try {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        
        // Scan for main JS bundle script tags
        const jsMatches = html.match(/\/assets\/[a-zA-Z0-9_-]+\.js/g);
        if (jsMatches) {
          const uniqueJs = Array.from(new Set(jsMatches));
          uniqueJs.forEach(jsUrl => {
            linkDirectives.push(`<${jsUrl}>; rel=modulepreload; as=script`);
          });
        }

        // Scan for main CSS stylesheet links
        const cssMatches = html.match(/\/assets\/[a-zA-Z0-9_-]+\.css/g);
        if (cssMatches) {
          const uniqueCss = Array.from(new Set(cssMatches));
          uniqueCss.forEach(cssUrl => {
            linkDirectives.push(`<${cssUrl}>; rel=preload; as=style`);
          });
        }
      }
    } catch (e) {
      console.warn('[PreloadConfig] Asset scanning warning:', e);
    }
  }

  return linkDirectives.join(', ');
}

/**
 * Express middleware to inject preload `Link` headers into initial HTML requests.
 */
export function createPreloadMiddleware(distPath?: string) {
  let cachedLinkHeader: string | null = null;

  return (req: Request, res: Response, next: NextFunction) => {
    // Only attach Link headers on main page navigation requests (HTML document requests)
    const isHtmlRequest = req.method === 'GET' && 
                          !req.path.startsWith('/api') && 
                          !path.extname(req.path);

    if (isHtmlRequest) {
      if (!cachedLinkHeader) {
        cachedLinkHeader = buildPreloadHeaderString(distPath);
      }

      if (cachedLinkHeader) {
        res.setHeader('Link', cachedLinkHeader);
      }
    }
    next();
  };
}
