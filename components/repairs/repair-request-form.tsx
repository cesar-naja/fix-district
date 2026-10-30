"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { INITIAL_FORM_STATE, type RepairFormState } from "@/lib/repairs/form-state";
import {
  DEVICE_TYPES,
  DEVICE_TYPE_LABEL,
  EMPTY_VALUES,
  LIMITS,
  validateRepairInput,
  type FieldErrors,
  type FieldName,
  type RepairFormValues,
} from "@/lib/repairs/schema";

type Props = {
  /** One-time key from the server. Makes a retried submission a no-op. */
  requestKey: string;
  action: (
    previous: RepairFormState,
    formData: FormData,
  ) => Promise<RepairFormState>;
};

const controlClass =
  "block w-full min-h-12 border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted aria-[invalid=true]:border-accent aria-[invalid=true]:border-4";

const FIELD_ORDER: FieldName[] = ["deviceType", "brand", "model", "description"];

const FIELD_LABEL: Record<FieldName, string> = {
  deviceType: "Device type",
  brand: "Brand",
  model: "Model",
  description: "What’s wrong?",
};

function fieldId(name: FieldName) {
  return `repair-${name}`;
}

export function RepairRequestForm({ requestKey, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_FORM_STATE);
  // Errors found by the in-browser check. The server repeats the same check.
  const [clientFailure, setClientFailure] = useState<{
    errors: FieldErrors;
  } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const serverError = state.status === "error" ? state : null;
  const errors: FieldErrors = clientFailure?.errors ?? serverError?.errors ?? {};
  const message = clientFailure ? undefined : serverError?.message;
  // After a failed save the form is re-filled from what the server received.
  const values: RepairFormValues = serverError?.values ?? EMPTY_VALUES;
  const errorFields = FIELD_ORDER.filter((name) => errors[name]);
  const hasProblem = errorFields.length > 0 || Boolean(message);

  useEffect(() => {
    if (hasProblem) summaryRef.current?.focus();
  }, [hasProblem, clientFailure, serverError]);

  useEffect(() => {
    if (state.status === "success") successRef.current?.focus();
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="border-2 border-ink bg-paper p-8 sm:p-10"
      >
        <p className="label text-accent">Request submitted</p>
        <h2 className="display mt-3 text-4xl sm:text-5xl">We’ve got it</h2>
        <p className="prose-measure mt-4 text-ink-soft">
          Your repair request was saved with the status Submitted. Our
          technicians can see it now.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <ButtonLink href={`/customer/repairs/${state.id}`}>
            View this request
          </ButtonLink>
          <ButtonLink href="/customer" variant="secondary">
            Back to My repairs
          </ButtonLink>
        </div>
      </div>
    );
  }

  function checkBeforeSending(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const result = validateRepairInput({
      deviceType: data.get("deviceType"),
      brand: data.get("brand"),
      model: data.get("model"),
      description: data.get("description"),
    });
    if (result.ok) {
      setClientFailure(null);
    } else {
      event.preventDefault();
      setClientFailure({ errors: result.errors });
    }
  }

  function describedBy(name: FieldName, hint?: string) {
    return [hint, errors[name] ? `${fieldId(name)}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  }

  function fieldError(name: FieldName) {
    const error = errors[name];
    if (!error) return null;
    return (
      <p id={`${fieldId(name)}-error`} className="mt-2 font-semibold text-accent">
        <span className="label mr-2">Error</span>
        {error}
      </p>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={checkBeforeSending}
      noValidate
      aria-busy={isPending}
      className="border-2 border-ink bg-paper p-6 sm:p-10"
    >
      <input type="hidden" name="requestKey" value={requestKey} />

      {hasProblem ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          aria-labelledby="repair-form-problem"
          className="mb-8 border-2 border-accent bg-white p-5"
        >
          <p id="repair-form-problem" className="font-bold text-accent">
            {errorFields.length > 0
              ? "Please fix the following before sending:"
              : "Your request was not saved."}
          </p>
          {message ? <p className="mt-2 text-ink">{message}</p> : null}
          {errorFields.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {errorFields.map((name) => (
                <li key={name}>
                  <a
                    href={`#${fieldId(name)}`}
                    className="font-semibold text-accent underline underline-offset-4"
                  >
                    {FIELD_LABEL[name]}: {errors[name]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <fieldset
        id={fieldId("deviceType")}
        aria-describedby={describedBy("deviceType")}
        tabIndex={-1}
        className="min-w-0"
      >
        <legend className="mb-3 font-semibold">
          {FIELD_LABEL.deviceType} <span className="label text-muted">Required</span>
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DEVICE_TYPES.map((type) => (
            <label
              key={type}
              className="flex min-h-12 cursor-pointer items-center justify-center border-2 border-ink bg-white px-3 py-2 text-center font-semibold has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name="deviceType"
                value={type}
                defaultChecked={values.deviceType === type}
                className="sr-only"
              />
              {DEVICE_TYPE_LABEL[type]}
            </label>
          ))}
        </div>
        {fieldError("deviceType")}
      </fieldset>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <label htmlFor={fieldId("brand")} className="mb-2 block font-semibold">
            {FIELD_LABEL.brand} <span className="label text-muted">Required</span>
          </label>
          <input
            id={fieldId("brand")}
            name="brand"
            type="text"
            autoComplete="off"
            maxLength={LIMITS.brand.max}
            defaultValue={values.brand}
            aria-invalid={errors.brand ? true : undefined}
            aria-describedby={describedBy("brand")}
            placeholder="For example, Apple"
            className={controlClass}
          />
          {fieldError("brand")}
        </div>
        <div>
          <label htmlFor={fieldId("model")} className="mb-2 block font-semibold">
            {FIELD_LABEL.model} <span className="label text-muted">Required</span>
          </label>
          <input
            id={fieldId("model")}
            name="model"
            type="text"
            autoComplete="off"
            maxLength={LIMITS.model.max}
            defaultValue={values.model}
            aria-invalid={errors.model ? true : undefined}
            aria-describedby={describedBy("model")}
            placeholder="For example, iPhone 13"
            className={controlClass}
          />
          {fieldError("model")}
        </div>
      </div>

      <div className="mt-8">
        <label
          htmlFor={fieldId("description")}
          className="mb-2 block font-semibold"
        >
          {FIELD_LABEL.description}{" "}
          <span className="label text-muted">Required</span>
        </label>
        <p id="repair-description-hint" className="mb-2 text-sm text-ink-soft">
          Tell us what happens and when it started. {LIMITS.description.min} to{" "}
          {LIMITS.description.max.toLocaleString("en-US")} characters. Do not
          include passwords, PINs, or payment details.
        </p>
        <textarea
          id={fieldId("description")}
          name="description"
          rows={6}
          maxLength={LIMITS.description.max}
          defaultValue={values.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy("description", "repair-description-hint")}
          className={controlClass}
        />
        {fieldError("description")}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-12 items-center justify-center border-2 border-accent bg-accent px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.14em] text-paper transition-colors hover:border-ink hover:bg-ink disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted"
        >
          {isPending ? "Saving…" : "Submit request"}
        </button>
        <ButtonLink href="/customer" variant="secondary">
          Cancel
        </ButtonLink>
        <p role="status" className="text-ink-soft">
          {isPending ? "Saving your request…" : ""}
        </p>
      </div>
    </form>
  );
}
