import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationResult {
  isValid: boolean;
  confidence: number;
  checks: {
    hasText: boolean;
    hasPhoto: boolean;
    isGovernmentID: boolean;
    isNotExpired: boolean;
    qualityScore: number;
  };
  extractedData?: {
    documentType?: string;
    expiryDate?: string;
    issueDate?: string;
  };
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, filePath } = await req.json();

    if (!userId || !filePath) {
      throw new Error("Missing userId or filePath");
    }

    console.log(`[VERIFY-ID] Starting verification for user ${userId}`);

    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from("identity-docs")
      .download(filePath);

    if (downloadError) throw downloadError;

    const arrayBuffer = await fileData.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const result = await verifyIDWithAI(base64Image);

    console.log(`[VERIFY-ID] Verification result:`, result);

    const newStatus = result.isValid && result.confidence >= 0.7 ? "verified" : "rejected";
    const rejectionReason = !result.isValid ? result.reason : null;

    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        id_status: newStatus,
        id_verified_at: newStatus === "verified" ? new Date().toISOString() : null,
        id_rejected_reason: rejectionReason,
        id_verified_by: "auto-ai",
      })
      .eq("auth_id", userId)
;

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        confidence: result.confidence,
        checks: result.checks,
        reason: rejectionReason,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[VERIFY-ID] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

async function verifyIDWithAI(base64Image: string): Promise<VerificationResult> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  
  if (!openaiKey) {
    console.warn("[VERIFY-ID] No OpenAI key, using basic validation");
    return basicImageValidation(base64Image);
  }

  try {
    console.log("[VERIFY-ID] Calling OpenAI API...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an ID verification expert. Analyze the provided image and determine if it's a valid government-issued photo ID (driver's license, passport, national ID card, etc.).

Return a JSON response with:
{
  "isValid": boolean,
  "confidence": number (0-1),
  "checks": {
    "hasText": boolean,
    "hasPhoto": boolean,
    "isGovernmentID": boolean,
    "isNotExpired": boolean,
    "qualityScore": number (0-1)
  },
  "extractedData": {
    "documentType": string,
    "expiryDate": string (if visible),
    "issueDate": string (if visible)
  },
  "reason": string (if rejected)
}

Validation criteria:
- Must be a government-issued photo ID
- Must have a clear photo of a person
- Must have visible text/information
- Must not be expired (if expiry date visible)
- Must be clear and readable (not blurry)
- Must not be a screenshot or photocopy
- Must not be tampered with

Be strict but fair. Only approve clear, legitimate IDs.`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "high"
                }
              },
              {
                type: "text",
                text: "Analyze this ID document and provide verification results in JSON format."
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VERIFY-ID] OpenAI API error response:", errorText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log("[VERIFY-ID] AI verification complete:", result);
    
    return result;
  } catch (error) {
    console.error("[VERIFY-ID] AI verification failed, falling back to basic:", error);
    return basicImageValidation(base64Image);
  }
}

function basicImageValidation(base64Image: string): VerificationResult {
  const imageSize = base64Image.length;
  const minSize = 10000;
  const maxSize = 10000000;

  const isValidSize = imageSize >= minSize && imageSize <= maxSize;
  const qualityScore = Math.min(imageSize / 500000, 1);

  return {
    isValid: isValidSize,
    confidence: 0.5,
    checks: {
      hasText: true,
      hasPhoto: true,
      isGovernmentID: true,
      isNotExpired: true,
      qualityScore: qualityScore,
    },
    extractedData: {
      documentType: "unknown",
    },
    reason: isValidSize ? undefined : "Image size invalid - too small or too large",
  };
}
