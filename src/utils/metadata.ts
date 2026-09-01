import { UNIVERSAL_LOGO_URL } from '../constants/logo';

export interface MetadataConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonicalUrl?: string;
  robots?: string;
}

/**
 * Dynamically updates document title and head meta tags for SEO and Open Graph.
 * Perfectly styled for client-side single page applications (SPA).
 */
export function generateMetadata(config: MetadataConfig) {
  if (typeof window === 'undefined') return;

  const defaultTitle = 'Frosty Bite | Delicious Desserts & Quick Bites';
  const defaultDescription = 'Order the best desserts, delicious cheesecakes, ice creams, and fast food online. Quick delivery, fresh ingredients, and sweetest treats in town.';

  const title = config.title ? `${config.title} | Frosty Bite` : defaultTitle;
  document.title = title;

  const description = config.description || defaultDescription;

  // Helper helper to set/update meta name
  const setMetaByName = (name: string, content: string) => {
    let element = document.querySelector(`meta[name="${name}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute('name', name);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  // Helper helper to set/update meta property (OG tags)
  const setMetaByProperty = (property: string, content: string) => {
    let element = document.querySelector(`meta[property="${property}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute('property', property);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  // Set description
  setMetaByName('description', description);

  // Set keywords
  if (config.keywords && config.keywords.length > 0) {
    setMetaByName('keywords', config.keywords.join(', '));
  } else {
    setMetaByName('keywords', 'dessert delivery, online cake order, fast food delivery, cheesecakes, burgers, fries, shakes, Frosty Bite');
  }

  // Set OG tags
  setMetaByProperty('og:title', config.ogTitle || title);
  setMetaByProperty('og:description', config.ogDescription || description);
  setMetaByProperty('og:type', config.ogType || 'website');
  setMetaByProperty('og:url', config.ogUrl || window.location.href);
  if (config.ogImage) {
    setMetaByProperty('og:image', config.ogImage);
  } else {
    // Fallback default placeholder if no image supplied
    setMetaByProperty('og:image', UNIVERSAL_LOGO_URL);
  }

  // Set Twitter tags
  setMetaByName('twitter:card', config.twitterCard || 'summary_large_image');
  setMetaByName('twitter:title', config.twitterTitle || config.ogTitle || title);
  setMetaByName('twitter:description', config.twitterDescription || config.ogDescription || description);
  if (config.twitterImage || config.ogImage) {
    setMetaByName('twitter:image', config.twitterImage || config.ogImage || '');
  } else {
    setMetaByName('twitter:image', UNIVERSAL_LOGO_URL);
  }

  // Set Canonical link
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', config.canonicalUrl || window.location.href);

  // Set Robots
  if (config.robots) {
    setMetaByName('robots', config.robots);
  } else {
    setMetaByName('robots', 'index, follow');
  }
}
