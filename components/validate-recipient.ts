import type { FormEvent } from "react";
import { customerSchema } from "@/lib/recipient";

export function validateRecipient(event: FormEvent<HTMLFormElement>) {
  const form = event.currentTarget;
  const submitter = (event.nativeEvent as SubmitEvent).submitter;
  if (submitter instanceof HTMLButtonElement && submitter.formNoValidate) return true;
  const result = customerSchema.safeParse(Object.fromEntries(new FormData(form)));
  if (result.success) return true;
  event.preventDefault();
  const issue = result.error.issues[0];
  const field = form.elements.namedItem(String(issue.path[0]));
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
    field.setCustomValidity(issue.message);
    field.reportValidity();
    field.setCustomValidity("");
  }
  return false;
}
