import { z } from "zod";

export const StandardItemSchema = z.object({
  title: z.string(),
  url: z.url(),
  context: z.string(),
  author: z.string().optional(),
  source: z.string(),
  score: z.number().optional(),
  tags: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
});

export const TrendItemSchema = z.object({
  title: z.string(),
  context: z.string(),
  citations: z.array(
    z.object({
      text: z.string(),
      source: z.string(),
      url: z.url(),
    }),
  ),
});

export const SectionSchema = z
  .object({
    title: z.string(),
    type: z.enum(["standard", "trend"]),
    items: z.array(z.union([StandardItemSchema, TrendItemSchema])),
  })
  .refine(
    (section) => {
      if (section.type === "standard") {
        return section.items.every(
          (item) => StandardItemSchema.safeParse(item).success,
        );
      }
      return section.items.every(
        (item) => TrendItemSchema.safeParse(item).success,
      );
    },
    { message: "Items must match section type" },
  );

export const SynthesisSchema = z.object({
  sections: z.array(SectionSchema),
});

export type SynthesisData = z.infer<typeof SynthesisSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type StandardItem = z.infer<typeof StandardItemSchema>;
export type TrendItem = z.infer<typeof TrendItemSchema>;