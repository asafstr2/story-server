const isProduction = process.env.NODE_ENV === "production";
export default {
  jwtSecret: process.env.JWT_SECRET ?? "my_super_secret",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  mongoURI: process.env.MONGODB_CONNECTION ?? "",
  redirectAuthUri: isProduction
    ? process.env.PROD_AUTH_REDIRECT_URL
    : process.env.AUTH_REDIRECT_URL ?? "",
  clientUrl: isProduction
    ? process.env.PROD_CLIENT_URL
    : process.env.CLIENT_URL ?? "http://localhost:5173",
  redirectAuthUriSuccess: isProduction
    ? process.env.PROD_AUTH_REDIRECT_URL_SUCCESS
    : process.env.AUTH_REDIRECT_URL_SUCCESS ?? "",
};
