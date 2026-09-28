# Architecture decisions

- Use `src/lib/officialBranding.ts` as the single source for the embedded official logo in generated Word and Excel files, so exports work offline and branding remains consistent.