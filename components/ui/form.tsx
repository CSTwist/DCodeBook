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

export function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const { getFieldState, formState } = useFormContext();
  const fieldState = getFieldState(fieldContext.name, formState);
  return { ...fieldContext, ...fieldState };
}

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { error } = useFormField();
  return <Label className={cn(error && "text-destructive", className)} {...props} />;
}

export function FormControl({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { error } = useFormField();
  return <div aria-invalid={!!error} {...props} />;
}

export function FormMessage({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { error } = useFormField();
  const body = error ? String(error?.message ?? "") : null;
  if (!body) return null;
  return (
    <p className={cn("text-destructive text-sm font-medium", className)} {...props}>
      {body}
    </p>
  );
}
