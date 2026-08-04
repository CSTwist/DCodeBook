"use client";

import * as React from "react";
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
  type UseFormReturn,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Form<T extends FieldValues>({
  form,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement> & {
  form: UseFormReturn<T>;
}) {
  return (
    <FormProvider {...form}>
      <form {...props} className={className}>
        {children}
      </form>
    </FormProvider>
  );
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { name: TName };

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
);

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();
  const generatedId = React.useId();

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const id = itemContext?.id ?? generatedId;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

export function FormLabel({ className, htmlFor, ...props }: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();
  return (
    <Label
      htmlFor={htmlFor ?? formItemId}
      className={cn(error && "text-destructive", className)}
      {...props}
    />
  );
}

export function FormControl({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { error, formItemId, formMessageId } = useFormField();
  const ariaDescribedBy = error ? formMessageId : undefined;

  if (React.isValidElement(children)) {
    const child = children as React.ReactElement<Record<string, unknown>>;
    return React.cloneElement(child, {
      id: child.props.id ?? formItemId,
      "aria-invalid": child.props["aria-invalid"] ?? (error ? true : undefined),
      "aria-describedby": child.props["aria-describedby"] ?? ariaDescribedBy,
      ...props,
    });
  }

  return (
    <div
      id={formItemId}
      aria-invalid={!!error}
      aria-describedby={ariaDescribedBy}
      {...props}
    >
      {children}
    </div>
  );
}

export function FormMessage({ className, id, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : null;
  if (!body) return null;
  return (
    <p
      id={id ?? formMessageId}
      className={cn("text-destructive text-sm font-medium", className)}
      {...props}
    >
      {body}
    </p>
  );
}

