"use client";

import {useEffect} from "react";
import NextError from "next/error";
import {recordSupportDiagnosticEvent} from "@/lib/data/oscar/SupportDiagnostics";

export default function GlobalError({
  error,
}: {
  error?: Error & {digest?: string};
}) {
  useEffect(() => {
    if (error) {
      recordSupportDiagnosticEvent({
        category: "runtime",
        level: "error",
        message: `Global React boundary error: ${error.name}: ${error.message}`,
        details: {
          digest: error.digest ?? null,
        },
      });
      const msg = `${error.name ?? ""} ${error.message ?? ""}`;
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(msg)) {
        try {
          const key = `oscar.chunkReload:${window.location.pathname}`;
          const prev = Number(window.sessionStorage.getItem(key) ?? "0");
          if (Date.now() - prev > 15_000) {
            window.sessionStorage.setItem(key, String(Date.now()));
            window.location.reload();
          }
        } catch {
          // Ignore sessionStorage failures in restricted browser modes
        }
      }
    }
  }, [error]);

  return (
    <html>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
