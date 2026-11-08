import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { ClassValue } from "clsx";

// Builds a className from Tailwind classes and conditions: cn("p-4", { "bg-red-600": isTalking }).
// tailwind-merge resolves conflicts, so of "p-2" and "p-4" the last one wins.
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
