self.__BUILD_MANIFEST = {
  "/": [
    "static/chunks/pages/index.js"
  ],
  "/analyze": [
    "static/chunks/pages/analyze.js"
  ],
  "/playlist": [
    "static/chunks/pages/playlist.js"
  ],
  "/upload": [
    "static/chunks/pages/upload.js"
  ],
  "__rewrites": {
    "afterFiles": [],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/",
    "/_app",
    "/_error",
    "/analyze",
    "/api/analyze",
    "/api/auth/callback",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/me",
    "/api/playlist",
    "/api/playlist-preview",
    "/api/test-credentials",
    "/api/test-permissions",
    "/api/verify-credentials",
    "/playlist",
    "/upload"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()