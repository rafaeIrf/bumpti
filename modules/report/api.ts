import { supabase } from "@/modules/supabase/client";
import { extractEdgeErrorMessage } from "@/modules/supabase/edge-error";

type SubmitReportParams = {
  reportedUserId: string;
  reason: string;
  category?: string | null;
};

type SubmitReportResponse = {
  status: "ok";
  report_id: string;
};

export async function submitReport({
  reportedUserId,
  reason,
  category,
}: SubmitReportParams): Promise<SubmitReportResponse> {
  const payload = {
    reported_user_id: reportedUserId,
    reason,
    category: category ?? null,
  };

  try {
    const { data, error } =
      await supabase.functions.invoke<SubmitReportResponse>("report-user", {
        body: payload,
      });

    if (error) {
      console.error("submitReport (edge) error:", error);
      const message = await extractEdgeErrorMessage(
        error,
        "Failed to submit report."
      );
      throw new Error(message);
    }

    if (!data) {
      throw new Error("No response from report-user.");
    }

    return data;
  } catch (err) {
    console.error("submitReport (api) error:", err);
    throw err instanceof Error
      ? err
      : new Error("Unexpected error submitting report.");
  }
}
