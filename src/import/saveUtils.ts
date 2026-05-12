import { RubricType } from "@prisma/client";

export function toRubricType(type: string): RubricType {
  if (type === "boolean") return RubricType.BOOLEAN;
  if (type === "ordinal") return RubricType.ORDINAL;
  return RubricType.NUMERICAL;
}

export function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}
