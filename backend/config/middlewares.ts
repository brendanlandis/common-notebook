export default ({ env }) => {
  const s3BucketUrl = `${env('AWS_BUCKET')}.s3.${env('AWS_REGION')}.amazonaws.com`;

  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: "strapi::security",
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "connect-src": ["'self'", "https:"],
            "img-src": [
              "'self'",
              "data:",
              "blob:",
              "market-assets.strapi.io",
              s3BucketUrl,
            ],
            "media-src": [
              "'self'",
              "data:",
              "blob:",
              "market-assets.strapi.io",
              s3BucketUrl,
            ],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    'strapi::cors',
    'strapi::poweredBy',
    'strapi::query',
    {
      name: "strapi::body",
      config: {
        formLimit: "1024mb", // modify form body
        jsonLimit: "1024mb", // modify JSON body
        textLimit: "1024mb", // modify text body
        enabled: true,
        multipart: true,
        formidable: {
          maxFileSize: 10 * 1024 * 1024 * 1024, // multipart data, modify here limit of uploaded file size
        },
      },
    },
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
