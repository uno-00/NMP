import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ActionPanel,
  DataPanel,
  EmptyState,
  FlowNotice,
  FormSelect,
  PanelLoading,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { ClientFieldInput } from "@/components/client/ClientFieldInput";
import { ClientFormFileViewerDialog } from "@/components/client/ClientFormFileViewerDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import type { FormRecord, LiveFormField } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { fieldHasAnswer } from "@/lib/form-field-values";
import { CLIENT_REQUESTS } from "@/lib/navigation";
import { dataUrlToFile } from "@/lib/upload-data-url";

type ClientSubmitFormProps = {
  initialFormId?: string;
};

async function prepareAnswersForSubmit(
  fields: LiveFormField[],
  fieldAnswers: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const prepared = { ...fieldAnswers };

  for (const field of fields) {
    if (field.type !== "signature") continue;
    const value = prepared[field.variable];
    if (typeof value !== "string" || !value.startsWith("data:image/")) continue;

    const file = await dataUrlToFile(
      value,
      `signature-${field.variable.replace(/\W/g, "") || "field"}`,
    );
    const { file: uploaded } = await api.uploadFile(file);
    prepared[field.variable] = uploaded.url;
  }

  return prepared;
}

export function ClientSubmitForm({ initialFormId }: ClientSubmitFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFormId, setSelectedFormId] = useState(initialFormId ?? "");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [uploading, setUploading] = useState(false);
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const { data: formsData, isLoading: formsLoading } = useQuery({
    queryKey: ["published-forms"],
    queryFn: () => api.publishedForms(),
  });

  const { data: formData, isLoading: formLoading } = useQuery({
    queryKey: ["published-form", selectedFormId],
    queryFn: () => api.getPublishedForm(selectedFormId),
    enabled: Boolean(selectedFormId),
  });

  useEffect(() => {
    if (initialFormId) setSelectedFormId(initialFormId);
  }, [initialFormId]);

  const form = formData?.form;

  const submitMutation = useMutation({
    mutationFn: async ({
      form: f,
      fieldAnswers,
    }: {
      form: FormRecord;
      fieldAnswers: Record<string, unknown>;
    }) => {
      const answersPayload = await prepareAnswersForSubmit(f.fields, fieldAnswers);
      return api.createTicket({
        formId: f._id,
        answers: answersPayload,
      });
    },
    onSuccess: (res) => {
      toast.success("Request submitted", {
        description: `Ticket ${res.ticket.ticketNumber} is pending admin approval.`,
      });
      setAnswers({});
      void queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      void navigate({ to: CLIENT_REQUESTS });
    },
    onError: (err: Error) => toast.error(err.message || "Submission failed"),
  });

  const setField = (variable: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [variable]: value }));
  };

  const handleFieldFileUpload = async (field: LiveFormField, file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    setUploading(true);
    try {
      const { file: uploaded } = await api.uploadFile(file);
      setField(field.variable, uploaded.url);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (formsLoading) {
    return <PanelLoading label="Loading available forms…" />;
  }

  const forms = formsData?.items ?? [];
  if (forms.length === 0) {
    return (
      <>
        <WorkspacePageHeader
          title="Submit Request"
          description={`Submitting as ${user?.name ?? user?.email ?? "your account"}.`}
          bordered
        />
        <DataPanel title="Available forms">
          <EmptyState
            title="No forms available."
            description="Published TA forms will appear here when Records approves them."
          />
        </DataPanel>
      </>
    );
  }

  return (
    <>
      <WorkspacePageHeader
        title="Submit Request"
        description={`Submitting as ${user?.name ?? user?.email ?? "your account"}. This request will appear in your list only.`}
        bordered
      />

      <ActionPanel title="Choose a form" description="Select a published TA form, then complete the fields below.">
        <div className="space-y-2">
          <Label>Published form</Label>
          <FormSelect
            value={selectedFormId}
            onChange={(e) => {
              setSelectedFormId(e.target.value);
              setAnswers({});
            }}
          >
            <option value="">Select a form…</option>
            {forms.map((f) => (
              <option key={f._id} value={f._id}>
                {f.title}
              </option>
            ))}
          </FormSelect>
        </div>

        {selectedFormId && formLoading ? (
          <PanelLoading label="Loading form fields…" />
        ) : form ? (
          <>
            {form.printTemplateImagePath?.trim() ? (
              <FlowNotice tone="info" title="Review the TA form">
                Open the uploaded template before filling in your request fields.
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-sm"
                    onClick={() => setFilePreviewOpen(true)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View form file
                  </Button>
                </div>
              </FlowNotice>
            ) : null}

            <form
              className="space-y-5 border-t border-border/70 pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const current = answersRef.current;
                const hasValue = form.fields.some((field) =>
                  fieldHasAnswer(field, current[field.variable]),
                );
                if (!hasValue) {
                  toast.error("Fill in at least one field before submitting.");
                  return;
                }
                submitMutation.mutate({ form, fieldAnswers: { ...current } });
              }}
            >
              {form.fields.map((field) => (
                <ClientFieldInput
                  key={field.id}
                  field={field}
                  value={answers[field.variable]}
                  onChange={(v) => setField(field.variable, v)}
                  onFile={
                    field.type === "file" ? (file) => handleFieldFileUpload(field, file) : undefined
                  }
                  uploading={uploading}
                />
              ))}
              <Button type="submit" disabled={submitMutation.isPending} className="shadow-sm">
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit request"
                )}
              </Button>
            </form>

            <ClientFormFileViewerDialog
              formId={form._id}
              formTitle={form.title}
              refNumber={form.refNumber}
              answers={answers}
              open={filePreviewOpen}
              onOpenChange={setFilePreviewOpen}
            />
          </>
        ) : null}
      </ActionPanel>
    </>
  );
}
