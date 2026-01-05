import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  console.log("=== Stripe Connect Refresh ===");
  console.log("URL:", req.url);
  
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  
  // Log all query parameters
  console.log("Query params:", Object.fromEntries(searchParams.entries()));
  
  // Build deep link to open the app
  const appScheme = Deno.env.get("APP_SCHEME") || "wrenchgo";
  const deepLink = `${appScheme}://stripe-connect-refresh?${searchParams.toString()}`;
  
  console.log("Redirecting to app:", deepLink);
  
  // Return HTML that redirects to the app
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Stripe Connect - Refresh</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            text-align: center;
          }
          .container {
            max-width: 400px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }
          h1 {
            margin: 0 0 20px 0;
            font-size: 28px;
          }
          p {
            margin: 0 0 30px 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: white;
            color: #f5576c;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: transform 0.2s;
          }
          .button:hover {
            transform: scale(1.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h1>⟳ Session Expired</h1>
          <p>Returning to WrenchGo to restart setup...</p>
          <p style="font-size: 14px; opacity: 0.7;">If the app doesn't open automatically:</p>
          <a href="${deepLink}" class="button">Open WrenchGo</a>
        </div>
        <script>
          // Attempt to open the app immediately
          window.location.href = "${deepLink}";
          
          // Fallback: try again after a short delay
          setTimeout(() => {
            window.location.href = "${deepLink}";
          }, 1000);
        </script>
      </body>
    </html>
  `;
  
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
});
