export async function extractEdgeErrorMessage(
  error: unknown,
  fallback = "Unexpected error"
): Promise<string> {
  const err = error as any;
  let message = err?.message || fallback;

  const maybeResponse = err?.context?.response || err?.response;
  if (maybeResponse) {
    try {
      const cloned = maybeResponse.clone();
      const text = await cloned.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          message =
            (json?.message as string) ||
            (json?.error as string) ||
            message;
        } catch {
          message = text;
        }
      }
    } catch {
      // ignore parse errors and keep fallback message
    }
  } else if (err?.context?.error) {
    message =
      err.context.error.message ||
      err.context.error.error ||
      message;
  }

  return message || fallback;
}
