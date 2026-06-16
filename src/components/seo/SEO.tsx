import { Helmet } from "react-helmet-async";

type SEOProps = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noindex?: boolean;
};

const SITE_NAME = "YouTube Growth Partner";
const SITE_URL = "https://ytgrowth.cloud";
const DEFAULT_IMAGE = "/og-image.png";

export function SEO({ title, description, path = "/", image = DEFAULT_IMAGE, noindex = false }: SEOProps) {
  const canonical = `${SITE_URL}${path}`;
  const fullTitle = `${title} | ${SITE_NAME}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large"} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${SITE_URL}${image}`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}${image}`} />
    </Helmet>
  );
}
