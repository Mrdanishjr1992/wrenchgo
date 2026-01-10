import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const appScheme = Deno.env.get("APP_SCHEME") || "wrenchgo";
  const deepLink = `${appScheme}://stripe-connect-return?${searchParams.toString()}`;
  const encodedDeepLink = encodeURI(deepLink);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="1;url=${encodedDeepLink}">
<title>Opening WrenchGo…</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#667eea;
  color:#fff;
  text-align:center;
  padding:20px
}
.box{
  background:rgba(255,255,255,.15);
  padding:40px;
  border-radius:16px;
  max-width:360px;
  width:100%
}
h1{font-size:24px;margin-bottom:12px}
p{opacity:.85;margin-bottom:24px}
a{
  display:inline-block;
  background:#fff;
  color:#667eea;
  padding:12px 28px;
  border-radius:24px;
  text-decoration:none;
  font-weight:600
}
</style>
</head>
<body>
  <div class="box">
    <h1>Setup Complete!</h1>
    <p>Opening WrenchGo…</p>
    <a href="${encodedDeepLink}" rel="noopener">Open App</a>
  </div>

  <script>
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setTimeout(() => {
        window.location.href = "${encodedDeepLink}";
      }, 50);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
});
